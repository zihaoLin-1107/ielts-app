"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { parseVocabularyInput } from "@/lib/parse-vocabulary";
import { createClient } from "@/lib/supabase-browser";

type Format = "csv" | "json" | "markdown";

const placeholders: Record<Format, string> = {
  csv: `word,meaning,example_sentence,source,tags,difficulty_level
acquire,获得,"Students acquire knowledge through practice.",CET4,"academic,verb",4`,
  json: `[
  {
    "word": "acquire",
    "meaning": "获得",
    "example_sentence": "Students acquire knowledge through practice.",
    "source": "CET4",
    "tags": ["academic", "verb"],
    "difficulty_level": 4
  }
]`,
  markdown: `- acquire | 获得 | Students acquire knowledge through practice. | CET4 | academic,verb | 4
- benefit | 好处；有益于 | Reading has many benefits. | CET4 | noun,verb | 4`
};

export default function VocabularyImportPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [format, setFormat] = useState<Format>("csv");
  const [text, setText] = useState(placeholders.csv);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function changeFormat(nextFormat: Format) {
    setFormat(nextFormat);
    setText(placeholders[nextFormat]);
    setMessage("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const rows = parseVocabularyInput(format, text);
      if (!rows.length) throw new Error("没有解析到有效单词");

      const { error } = await supabase.from("vocabulary_bank").insert(
        rows.map((row) => ({
          user_id: user.id,
          ...row
        }))
      );

      if (error) throw error;
      setMessage(`已导入 ${rows.length} 个词库单词`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-bold">导入词库</h1>
      <form onSubmit={submit} className="space-y-3">
        <select className="w-full rounded border border-stone-300 bg-white px-3 py-3" value={format} onChange={(event) => changeFormat(event.target.value as Format)}>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
          <option value="markdown">Markdown</option>
        </select>
        <textarea className="min-h-[55vh] w-full rounded border border-stone-300 bg-white px-3 py-3 font-mono text-sm" value={text} onChange={(event) => setText(event.target.value)} />
        <button disabled={saving} className="w-full rounded bg-sage px-4 py-3 font-semibold text-white disabled:opacity-60">
          {saving ? "导入中" : "导入词库"}
        </button>
        {message ? <p className="text-sm text-stone-600">{message}</p> : null}
      </form>
    </AppShell>
  );
}
