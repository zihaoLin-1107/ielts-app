"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { addDays } from "@/lib/date";
import { createClient } from "@/lib/supabase-browser";
import type { UserWord } from "@/lib/types";

export default function ReviewPage() {
  const supabase = useMemo(() => createClient(), []);
  const [words, setWords] = useState<UserWord[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const current = words[index];

  useEffect(() => {
    async function loadReviewWords() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setWords([]);
        return;
      }

      const { data } = await supabase
        .from("user_words")
        .select("*")
        .eq("user_id", user.id)
        .lte("next_review_at", new Date().toISOString())
        .gt("review_count", 0)
        .order("next_review_at", { ascending: true })
        .limit(50);

      setWords((data ?? []) as UserWord[]);
    }

    loadReviewWords();
  }, [supabase]);

  async function mark(days: number, delta: number) {
    if (!current) return;
    const now = new Date();
    const nextLevel = Math.max(0, Math.min(5, current.familiarity_level + delta));
    const updatePayload = {
      next_review_at: addDays(now, days).toISOString(),
      last_reviewed_at: now.toISOString(),
      review_count: current.review_count + 1,
      familiarity_level: nextLevel,
      last_review_result: delta > 0 ? "know" : delta < 0 ? "unknown" : "vague"
    };
    const { error } = await supabase
      .from("user_words")
      .update(updatePayload)
      .eq("id", current.id);

    if (error?.message.toLowerCase().includes("last_review_result")) {
      await supabase
        .from("user_words")
        .update({
          next_review_at: updatePayload.next_review_at,
          last_reviewed_at: updatePayload.last_reviewed_at,
          review_count: updatePayload.review_count,
          familiarity_level: updatePayload.familiarity_level
        })
        .eq("id", current.id);
    }

    setShowAnswer(false);
    setIndex((value) => value + 1);
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-bold">今日复习</h1>
      {!current ? (
        <div className="rounded border border-stone-200 bg-white p-5 text-center">今日待复习已完成</div>
      ) : (
        <section className="rounded border border-stone-200 bg-white p-5">
          <div className="mb-2 text-sm text-stone-500">
            {index + 1} / {words.length}
          </div>
          <h2 className="mb-5 text-3xl font-bold">{current.word}</h2>
          {showAnswer ? (
            <div className="mb-5 space-y-3">
              <p className="whitespace-pre-wrap text-lg">{current.meaning}</p>
              {current.example_sentence ? <p className="text-stone-600">{current.example_sentence}</p> : null}
            </div>
          ) : (
            <button onClick={() => setShowAnswer(true)} className="mb-5 w-full rounded border border-stone-300 px-4 py-3">
              显示答案
            </button>
          )}
          {showAnswer ? (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => mark(7, 1)} className="rounded bg-sage px-2 py-3 text-sm font-semibold text-white">认识</button>
              <button onClick={() => mark(3, 0)} className="rounded bg-amber-500 px-2 py-3 text-sm font-semibold text-white">模糊</button>
              <button onClick={() => mark(1, -1)} className="rounded bg-rose-600 px-2 py-3 text-sm font-semibold text-white">不认识</button>
            </div>
          ) : null}
        </section>
      )}
    </AppShell>
  );
}
