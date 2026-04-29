"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { WordLearningActions } from "@/components/WordLearningActions";
import { startOfTodayIso } from "@/lib/date";
import { createClient } from "@/lib/supabase-browser";
import type { UserWord, VocabularyBankWord } from "@/lib/types";

export default function DailyWordsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState(20);
  const [todayWords, setTodayWords] = useState<UserWord[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadTodayWords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_words")
      .select("*")
      .gte("first_learned_at", startOfTodayIso())
      .order("first_learned_at", { ascending: true });
    setTodayWords((data ?? []) as UserWord[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadTodayWords();
  }, [loadTodayWords]);

  async function generate() {
    setGenerating(true);
    setMessage("");

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("请先登录");

      const { data: existingToday } = await supabase
        .from("user_words")
        .select("*")
        .gte("first_learned_at", startOfTodayIso())
        .order("first_learned_at", { ascending: true });

      if (existingToday?.length) {
        setTodayWords(existingToday as UserWord[]);
        setMessage("今天已经抽取过单词，不会重复抽取。");
        return;
      }

      const { data: learnedRows } = await supabase.from("user_words").select("vocabulary_bank_id");
      const learnedIds = new Set((learnedRows ?? []).map((row) => row.vocabulary_bank_id));

      const { data: bankRows, error } = await supabase
        .from("vocabulary_bank")
        .select("*")
        .eq("is_active", true)
        .order("difficulty_level", { ascending: true, nullsFirst: false })
        .limit(1000);

      if (error) throw error;

      const candidates = ((bankRows ?? []) as VocabularyBankWord[]).filter((row) => !learnedIds.has(row.id));
      const selected = shuffleWithinDifficulty(candidates).slice(0, count);
      if (!selected.length) throw new Error("没有可抽取的新词，请先导入词库。");

      const now = new Date().toISOString();
      const { data: inserted, error: insertError } = await supabase
        .from("user_words")
        .insert(
          selected.map((row) => ({
            user_id: user.id,
            vocabulary_bank_id: row.id,
            word: row.word,
            meaning: row.meaning,
            example_sentence: row.example_sentence,
            source: row.source,
            tags: row.tags,
            first_learned_at: now,
            next_review_at: now
          }))
        )
        .select("*");

      if (insertError) throw insertError;
      setTodayWords((inserted ?? []) as UserWord[]);
      setMessage(`已生成 ${inserted?.length ?? 0} 个今日新词。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  }

  function updateRecordedWord(updatedWord: UserWord) {
    setTodayWords((items) => items.map((item) => (item.id === updatedWord.id ? updatedWord : item)));
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-bold">今日单词</h1>
      <section className="mb-4 rounded border border-stone-200 bg-white p-4">
        <label className="mb-3 block text-sm font-medium">
          抽取数量
          <input
            className="mt-1 w-full rounded border border-stone-300 px-3 py-3"
            type="number"
            min={5}
            max={50}
            value={count}
            onChange={(event) => setCount(Math.max(5, Math.min(50, Number(event.target.value) || 20)))}
          />
        </label>
        <button disabled={generating || todayWords.length > 0} onClick={generate} className="w-full rounded bg-sage px-4 py-3 font-semibold text-white disabled:opacity-60">
          {generating ? "生成中" : todayWords.length ? "今天已生成" : "生成今日单词"}
        </button>
        {message ? <p className="mt-3 text-sm text-stone-600">{message}</p> : null}
      </section>

      <section className="space-y-3">
        {loading ? <p className="rounded border border-stone-200 bg-white p-4 text-center">加载中</p> : null}
        {todayWords.map((item) => (
          <article key={item.id} className="rounded border border-stone-200 bg-white p-4">
            <h2 className="text-lg font-bold">{item.word}</h2>
            <p className="whitespace-pre-wrap">{item.meaning}</p>
            {item.example_sentence ? <p className="mt-2 text-sm text-stone-600">{item.example_sentence}</p> : null}
            {item.tags?.length ? <p className="mt-2 text-xs text-stone-500">{item.tags.join(" / ")}</p> : null}
            <WordLearningActions word={item} onRecorded={updateRecordedWord} />
          </article>
        ))}
        {!loading && !todayWords.length ? <p className="rounded border border-stone-200 bg-white p-4 text-center">今天还没有生成新词</p> : null}
      </section>
    </AppShell>
  );
}

function shuffleWithinDifficulty(rows: VocabularyBankWord[]) {
  const groups = new Map<string, VocabularyBankWord[]>();
  rows.forEach((row) => {
    const key = row.difficulty_level === null ? "unknown" : String(row.difficulty_level);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => {
      if (left === "unknown") return 1;
      if (right === "unknown") return -1;
      return Number(left) - Number(right);
    })
    .flatMap(([, group]) => group.sort(() => Math.random() - 0.5));
}
