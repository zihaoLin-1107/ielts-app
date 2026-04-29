"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { startOfTodayIso, startOfTomorrowIso } from "@/lib/date";
import { createClient } from "@/lib/supabase-browser";

export default function ImportPackPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const today = startOfTodayIso();
    const tomorrow = startOfTomorrowIso();
    const { data: todayRows } = await supabase
      .from("user_words")
      .select("word")
      .eq("user_id", user.id)
      .or(`and(first_learned_at.gte.${today},first_learned_at.lt.${tomorrow}),and(last_reviewed_at.gte.${today},last_reviewed_at.lt.${tomorrow})`);

    const { error } = await supabase.from("daily_training_packs").insert({
      user_id: user.id,
      title: title.trim() || `训练包 ${new Date().toLocaleDateString()}`,
      content_markdown: markdown,
      source_words: Array.from(new Set((todayRows ?? []).map((row) => row.word).filter(Boolean)))
    });

    if (error) alert(error.message);
    else router.push("/training-packs");
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-bold">导入训练包</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full rounded border border-stone-300 bg-white px-3 py-3" placeholder="标题" value={title} onChange={(event) => setTitle(event.target.value)} />
        <textarea required className="min-h-[55vh] w-full rounded border border-stone-300 bg-white px-3 py-3" placeholder="粘贴 Markdown" value={markdown} onChange={(event) => setMarkdown(event.target.value)} />
        <button className="w-full rounded bg-sage px-4 py-3 font-semibold text-white">保存</button>
      </form>
    </AppShell>
  );
}
