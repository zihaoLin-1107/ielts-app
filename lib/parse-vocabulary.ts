export type ParsedVocabularyRow = {
  word: string;
  meaning: string;
  example_sentence?: string | null;
  source?: string | null;
  tags: string[];
  difficulty_level?: number | null;
};

export function parseVocabularyInput(format: "csv" | "json" | "markdown", input: string): ParsedVocabularyRow[] {
  if (format === "json") return parseJson(input);
  if (format === "markdown") return parseMarkdown(input);
  return parseCsv(input);
}

function normalizeRow(row: Partial<ParsedVocabularyRow>): ParsedVocabularyRow | null {
  const word = String(row.word ?? "").trim();
  const meaning = String(row.meaning ?? "").trim();
  if (!word || !meaning) return null;

  return {
    word,
    meaning,
    example_sentence: cleanText(row.example_sentence),
    source: cleanText(row.source),
    tags: normalizeTags(row.tags),
    difficulty_level: normalizeDifficulty(row.difficulty_level)
  };
}

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDifficulty(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseJson(input: string) {
  const parsed = JSON.parse(input) as Partial<ParsedVocabularyRow>[];
  if (!Array.isArray(parsed)) throw new Error("JSON 必须是数组");
  return parsed.map(normalizeRow).filter(Boolean) as ParsedVocabularyRow[];
}

function parseMarkdown(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean)
    .map((line) => {
      const [word, meaning, example_sentence, source, tags, difficulty_level] = line.split("|").map((part) => part.trim());
      return normalizeRow({ word, meaning, example_sentence, source, tags: normalizeTags(tags), difficulty_level: normalizeDifficulty(difficulty_level) });
    })
    .filter(Boolean) as ParsedVocabularyRow[];
}

function parseCsv(input: string) {
  const rows = parseCsvRows(input);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return normalizeRow({
      word: record.word,
      meaning: record.meaning,
      example_sentence: record.example_sentence,
      source: record.source,
      tags: normalizeTags(record.tags),
      difficulty_level: normalizeDifficulty(record.difficulty_level)
    });
  }).filter(Boolean) as ParsedVocabularyRow[];
}

function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}
