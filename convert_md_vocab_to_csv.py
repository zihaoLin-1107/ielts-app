#!/usr/bin/env python3
"""
Convert Markdown vocabulary files into a Supabase-ready CSV.

Default input:  ./md_vocab_files/**/*.md
Default output: ./output/vocabulary_bank_import.csv

The script is intentionally conservative: rows that cannot be confidently
recognized are written to failed_rows.csv instead of being guessed into the
main import file.
"""

from __future__ import annotations

import argparse
import csv
import html
import os
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable


CSV_FIELDS = [
    "word",
    "meaning",
    "example_sentence",
    "source",
    "tags",
    "difficulty_level",
    "user_id",
]

DEFAULT_DIFFICULTY = 4
PARTS_OF_SPEECH = (
    "n",
    "v",
    "vi",
    "vt",
    "adj",
    "adv",
    "prep",
    "conj",
    "pron",
    "num",
    "art",
    "aux",
    "int",
    "V",
)


@dataclass
class VocabRow:
    word: str
    meaning: str
    example_sentence: str
    source: str
    tags: str
    difficulty_level: int
    user_id: str
    raw_line: str
    file_name: str


@dataclass
class FailedRow:
    file_name: str
    raw_line: str
    reason: str


@dataclass
class DuplicateRow:
    word: str
    first_source: str
    duplicate_source: str
    raw_line: str


class TableCellParser(HTMLParser):
    """Extract text from <td>/<th> cells in simple Markdown-exported HTML tables."""

    def __init__(self) -> None:
        super().__init__()
        self._in_cell = False
        self._chunks: list[str] = []
        self.cells: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in {"td", "th"}:
            self._in_cell = True
            self._chunks = []

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._chunks.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"td", "th"} and self._in_cell:
            cell = normalize_space(" ".join(self._chunks))
            if cell:
                self.cells.append(cell)
            self._in_cell = False
            self._chunks = []


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u3000", " ")).strip()


def strip_markdown(value: str) -> str:
    """Remove lightweight Markdown decoration while preserving useful text."""
    value = html.unescape(value)
    value = re.sub(r"\\mathsf\{([^}]+)}", r"\1", value)
    value = re.sub(r"\$([^$]+)\$", r"\1", value)
    value = value.replace("{", "").replace("}", "")
    value = re.sub(r"!\[[^\]]*]\([^)]+\)", "", value)
    value = re.sub(r"\[([^\]]+)]\([^)]+\)", r"\1", value)
    value = re.sub(r"^[\s>*#`~•-]+", "", value)
    value = value.replace("**", "").replace("__", "").replace("`", "")
    value = value.strip().strip("|").strip()
    return normalize_space(value)


def clean_word(value: str) -> str:
    value = strip_markdown(value)
    value = re.sub(r"^\d+[\s.)、_-]*", "", value)
    value = re.sub(r"^[./\\()_-]+", "", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip(" :：;；,.，")


def clean_meaning(value: str) -> str:
    value = strip_markdown(value)
    value = re.sub(r"^(meaning|释义|中文|意思)\s*[:：]\s*", "", value, flags=re.I)
    return value.strip(" :：")


def clean_tags(tags: Iterable[str]) -> str:
    seen: set[str] = set()
    cleaned: list[str] = []
    for tag in tags:
        for part in re.split(r"[,，;；|/]+", tag):
            item = strip_markdown(part).strip()
            if item and item.lower() not in seen:
                seen.add(item.lower())
                cleaned.append(item)
    return ",".join(cleaned)


def postgres_array_literal(csv_tags: str) -> str:
    """Return a PostgreSQL text[] literal suitable for Supabase CSV import."""
    if not csv_tags:
        return "{}"
    values = [tag.strip() for tag in csv_tags.split(",") if tag.strip()]
    escaped = []
    for value in values:
        value = value.replace("\\", "\\\\").replace('"', '\\"')
        escaped.append(f'"{value}"')
    return "{" + ",".join(escaped) + "}"


def parse_difficulty(value: str | None, default: int = DEFAULT_DIFFICULTY) -> int:
    if not value:
        return default
    match = re.search(r"(?:difficulty|难度)?\s*[:：]?\s*([1-9]|10)\b", value, flags=re.I)
    if not match:
        return default
    difficulty = int(match.group(1))
    return difficulty if 1 <= difficulty <= 10 else default


def source_from_path(path: Path) -> str:
    return path.stem


def base_tag_from_path(path: Path) -> str:
    return path.stem


def looks_like_heading(line: str) -> bool:
    if not line.startswith("#"):
        return False
    heading = strip_markdown(line)
    return bool(re.fullmatch(r"[A-Za-z][A-Za-z '-]{0,80}", heading))


def is_noise_line(line: str) -> bool:
    if line.lstrip().startswith("#"):
        return True
    cleaned = strip_markdown(line)
    if not cleaned:
        return True
    if cleaned.startswith("<table") or cleaned in {"</table>", "<tr>", "</tr>"}:
        return True
    if re.fullmatch(r"[-*_=\s]{3,}", cleaned):
        return True
    # Chinese-only headings or long explanatory paragraphs are not vocabulary rows.
    if not re.search(r"[A-Za-z]", cleaned):
        return True
    return False


def parse_pipe_row(
    line: str,
    source: str,
    base_tag: str,
    user_id: str,
    file_name: str,
) -> VocabRow | None:
    parts = [strip_markdown(part) for part in line.lstrip("-*+ ").split("|")]
    parts = [part for part in parts if part]
    if len(parts) < 2:
        return None

    word = clean_word(parts[0])
    meaning = clean_meaning(parts[1])
    if not is_valid_word(word) or not meaning:
        return None

    example = parts[2] if len(parts) >= 3 else ""
    tags = [base_tag]
    difficulty = DEFAULT_DIFFICULTY

    if len(parts) >= 4:
        tags.append(parts[3])
    if len(parts) >= 5:
        tags.append(parts[4])
    if len(parts) >= 6:
        difficulty = parse_difficulty(parts[5])

    return VocabRow(
        word=word,
        meaning=meaning,
        example_sentence=strip_markdown(example),
        source=source,
        tags=clean_tags(tags),
        difficulty_level=difficulty,
        user_id=user_id,
        raw_line=line,
        file_name=file_name,
    )


def parse_dash_row(
    line: str,
    source: str,
    base_tag: str,
    user_id: str,
    file_name: str,
) -> VocabRow | None:
    cleaned = strip_markdown(line)
    match = re.match(r"^([A-Za-z][A-Za-z0-9' -]{0,80})\s+[-–—]\s+(.+)$", cleaned)
    if not match:
        return None
    word = clean_word(match.group(1))
    meaning = clean_meaning(match.group(2))
    if not is_valid_word(word) or not meaning:
        return None
    return VocabRow(word, meaning, "", source, base_tag, DEFAULT_DIFFICULTY, user_id, line, file_name)


def parse_bold_colon_row(
    line: str,
    source: str,
    base_tag: str,
    user_id: str,
    file_name: str,
) -> VocabRow | None:
    match = re.match(r"^\s*\**\s*([^*：:]+?)\s*\**\s*[：:]\s*(.+)$", line)
    if not match:
        return None
    word = clean_word(match.group(1))
    meaning = clean_meaning(match.group(2))
    if not is_valid_word(word) or not meaning:
        return None
    return VocabRow(word, meaning, "", source, base_tag, DEFAULT_DIFFICULTY, user_id, line, file_name)


def parse_plain_vocab_row(
    line: str,
    source: str,
    base_tag: str,
    user_id: str,
    file_name: str,
) -> VocabRow | None:
    """
    Parse common exported rows such as:
      Abandon v.放弃, 遗弃
      analyze ['ænəlaiz] vt.分析
      1. accommodation n. 住宿，食宿
      affect 2
    """
    cleaned = strip_markdown(line)
    cleaned = re.sub(r"^\d+[\s.)、_-]*", "", cleaned)
    cleaned = re.sub(r"\[[^\]]+]", " ", cleaned)  # phonetic symbols
    cleaned = normalize_space(cleaned)

    if not cleaned or len(cleaned) > 240:
        return None

    pos_pattern = "|".join(PARTS_OF_SPEECH)
    match = re.match(
        rf"^([A-Za-z][A-Za-z' -]{{0,70}}?)\s+((?:(?:{pos_pattern})\.?/?&?\.?\s*)+)\s*(.+)$",
        cleaned,
        flags=re.I,
    )
    if not match:
        return None

    word = clean_word(match.group(1))
    pos = normalize_space(match.group(2)).strip()
    meaning = clean_meaning(match.group(3))
    if not is_valid_word(word) or not meaning:
        return None

    return VocabRow(
        word=word,
        meaning=normalize_space(f"{pos} {meaning}"),
        example_sentence="",
        source=source,
        tags=base_tag,
        difficulty_level=DEFAULT_DIFFICULTY,
        user_id=user_id,
        raw_line=line,
        file_name=file_name,
    )


def is_valid_word(word: str) -> bool:
    if not word or len(word) > 80:
        return False
    if not re.search(r"[A-Za-z]", word):
        return False
    if re.search(r"[:：<>]", word):
        return False
    # Avoid swallowing explanatory English headings as words.
    if len(word.split()) > 4:
        return False
    return True


def parse_block_rows(
    lines: list[str],
    source: str,
    base_tag: str,
    user_id: str,
    file_name: str,
) -> tuple[list[VocabRow], set[int]]:
    rows: list[VocabRow] = []
    consumed: set[int] = set()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip("\n")
        if not looks_like_heading(line):
            i += 1
            continue

        word = clean_word(strip_markdown(line))
        block: dict[str, str] = {}
        block_indices = {i}
        j = i + 1
        while j < len(lines):
            next_line = lines[j].rstrip("\n")
            if not next_line.strip():
                block_indices.add(j)
                j += 1
                continue
            if next_line.startswith("#"):
                break
            key_match = re.match(r"^\s*(meaning|example|tags|difficulty|释义|例句|标签|难度)\s*[:：]\s*(.+)$", next_line, flags=re.I)
            if not key_match:
                break
            block[key_match.group(1).lower()] = strip_markdown(key_match.group(2))
            block_indices.add(j)
            j += 1

        meaning = block.get("meaning") or block.get("释义") or ""
        if is_valid_word(word) and meaning:
            rows.append(
                VocabRow(
                    word=word,
                    meaning=clean_meaning(meaning),
                    example_sentence=strip_markdown(block.get("example") or block.get("例句") or ""),
                    source=source,
                    tags=clean_tags([base_tag, block.get("tags", ""), block.get("标签", "")]),
                    difficulty_level=parse_difficulty(block.get("difficulty") or block.get("难度")),
                    user_id=user_id,
                    raw_line="\n".join(lines[k].rstrip("\n") for k in sorted(block_indices)),
                    file_name=file_name,
                )
            )
            consumed.update(block_indices)
            i = j
        else:
            i += 1
    return rows, consumed


def pair_table_cells(cells: list[str]) -> list[str]:
    """
    Convert table cells to parseable row strings.

    Handles both "word meaning" cells and split cells like:
      <td>1.essay</td><td>n./v.短论文</td>
    """
    rows: list[str] = []
    i = 0
    while i < len(cells):
        current = cells[i]
        next_cell = cells[i + 1] if i + 1 < len(cells) else ""
        if re.match(r"^\d*[\s.)、_-]*[A-Za-z][A-Za-z' -]{0,70}$", current) and re.match(
            r"^(?:n|v|vi|vt|adj|adv|prep|conj|pron|num|art)\b",
            next_cell,
            flags=re.I,
        ):
            rows.append(f"{current} {next_cell}")
            i += 2
        else:
            rows.append(current)
            i += 1
    return rows


def split_multi_pos_entries(line: str) -> list[str]:
    """
    Split compact rows containing several entries:
      atmosphere n. 大气 hydrosphere n. 水圈 lithosphere n. 岩石圈
    """
    cleaned = strip_markdown(line)
    cleaned = re.sub(r"^\d+[\s.)、_-]*", "", cleaned)
    cleaned = re.sub(r"\[[^\]]+]", " ", cleaned)
    cleaned = normalize_space(cleaned)
    pos_pattern = "|".join(PARTS_OF_SPEECH)
    entry_pattern = re.compile(
        rf"([A-Za-z][A-Za-z' -]{{0,70}}?)\s+((?:(?:{pos_pattern})\.?/?&?\.?\s*)+)\s*"
        rf"(.+?)(?=\s+[A-Za-z][A-Za-z' -]{{0,70}}?\s+(?:(?:{pos_pattern})\.?/?&?\.?\s*)|$)",
        flags=re.I,
    )
    matches = list(entry_pattern.finditer(cleaned))
    if len(matches) <= 1:
        return [line]
    return [normalize_space(" ".join(match.groups())) for match in matches]


def extract_parseable_lines(text: str) -> list[str]:
    parser = TableCellParser()
    parser.feed(text)
    table_rows = pair_table_cells(parser.cells)

    # Remove full HTML tables from line parsing after extracting their cells.
    text_without_tables = re.sub(r"<table.*?</table>", "\n", text, flags=re.I | re.S)
    normal_lines = text_without_tables.splitlines()
    return normal_lines + table_rows


def parse_single_line(
    line: str,
    source: str,
    base_tag: str,
    user_id: str,
    file_name: str,
) -> VocabRow | None:
    if "|" in line:
        row = parse_pipe_row(line, source, base_tag, user_id, file_name)
        if row:
            return row

    for parser in (parse_dash_row, parse_bold_colon_row, parse_plain_vocab_row):
        row = parser(line, source, base_tag, user_id, file_name)
        if row:
            return row
    return None


def parse_file(path: Path, user_id: str) -> tuple[list[VocabRow], list[FailedRow]]:
    source = source_from_path(path)
    base_tag = base_tag_from_path(path)
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    lines = extract_parseable_lines(text)

    block_rows, consumed_indices = parse_block_rows(lines, source, base_tag, user_id, path.name)
    rows = list(block_rows)
    failed: list[FailedRow] = []
    last_parsed_row: VocabRow | None = rows[-1] if rows else None

    for index, line in enumerate(lines):
        raw = line.rstrip("\n")
        if index in consumed_indices or is_noise_line(raw):
            continue

        example_match = re.match(r"^\s*(例句|example)\s*[:：]\s*(.+)$", strip_markdown(raw), flags=re.I)
        if example_match and last_parsed_row:
            last_parsed_row.example_sentence = strip_markdown(example_match.group(2))
            continue

        parsed_rows: list[VocabRow] = []
        for candidate in split_multi_pos_entries(raw):
            parsed = parse_single_line(candidate, source, base_tag, user_id, path.name)
            if parsed:
                parsed.raw_line = raw
                parsed_rows.append(parsed)

        if parsed_rows:
            rows.extend(parsed_rows)
            last_parsed_row = parsed_rows[-1]
            continue

        if re.match(r"^[A-Za-z][A-Za-z' -]{1,60}\s+([1-9]|10)$", strip_markdown(raw)):
            failed.append(FailedRow(path.name, raw, "missing meaning"))
        else:
            failed.append(FailedRow(path.name, raw, "unrecognized format"))

    return rows, failed


def write_csv(path: Path, fieldnames: list[str], rows: Iterable[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def get_user_id() -> str:
    user_id = os.environ.get("SUPABASE_USER_ID", "").strip()
    if user_id:
        return user_id
    while not user_id:
        user_id = input("请输入 SUPABASE_USER_ID: ").strip()
    return user_id


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Convert Markdown vocabulary files to Supabase import CSV.")
    parser.add_argument("--input-dir", default="./md_vocab_files", help="Directory containing .md files.")
    parser.add_argument("--output-dir", default="./output", help="Directory for generated CSV files.")
    parser.add_argument(
        "--output-file",
        default="vocabulary_bank_import.csv",
        help="Main Supabase import CSV filename.",
    )
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    input_dir = Path(args.input_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_file = output_dir / args.output_file
    duplicate_file = output_dir / "skipped_duplicates.csv"
    failed_file = output_dir / "failed_rows.csv"

    user_id = get_user_id()
    md_files = sorted(input_dir.rglob("*.md")) if input_dir.exists() else []

    exported: list[VocabRow] = []
    failed_rows: list[FailedRow] = []
    duplicates: list[DuplicateRow] = []
    seen_words: dict[str, VocabRow] = {}

    for md_file in md_files:
        rows, failed = parse_file(md_file, user_id)
        failed_rows.extend(failed)
        for row in rows:
            key = row.word.lower()
            if key in seen_words:
                duplicates.append(
                    DuplicateRow(
                        word=row.word,
                        first_source=seen_words[key].source,
                        duplicate_source=row.source,
                        raw_line=row.raw_line,
                    )
                )
                continue
            seen_words[key] = row
            exported.append(row)

    write_csv(
        output_file,
        CSV_FIELDS,
        (
            {
                "word": row.word,
                "meaning": row.meaning,
                "example_sentence": row.example_sentence,
                "source": row.source,
                "tags": postgres_array_literal(row.tags),
                "difficulty_level": row.difficulty_level,
                "user_id": row.user_id,
            }
            for row in exported
        ),
    )
    write_csv(
        duplicate_file,
        ["word", "first_source", "duplicate_source", "raw_line"],
        (duplicate.__dict__ for duplicate in duplicates),
    )
    write_csv(
        failed_file,
        ["file_name", "raw_line", "reason"],
        (failed.__dict__ for failed in failed_rows),
    )

    print(f"扫描 md 文件数: {len(md_files)}")
    print(f"成功导出单词数: {len(exported)}")
    print(f"跳过重复单词数: {len(duplicates)}")
    print(f"无法解析行数: {len(failed_rows)}")
    print(f"主 CSV 输出路径: {output_file}")
    print(f"重复记录输出路径: {duplicate_file}")
    print(f"失败记录输出路径: {failed_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
