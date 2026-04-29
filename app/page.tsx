"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WordLearningActions } from "@/components/WordLearningActions";
import { startOfTodayIso } from "@/lib/date";
import { createClient } from "@/lib/supabase-browser";
import type { UserWord, VocabularyBankWord } from "@/lib/types";

const DAILY_WORD_COUNT = 20;

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [todayWords, setTodayWords] = useState<UserWord[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadTodayWords = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("请先登录后生成今日单词");
        setTodayWords([]);
        return;
      }

      const { data, error } = await supabase
        .from("user_words")
        .select("*")
        .eq("user_id", user.id)
        .gte("first_learned_at", startOfTodayIso())
        .order("first_learned_at", { ascending: true });

      if (error) throw error;
      setTodayWords((data ?? []) as UserWord[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载今日单词失败");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadTodayWords();
  }, [loadTodayWords]);

  async function generateTodayWords() {
    setGenerating(true);
    setMessage("");

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: learnedRows, error: learnedError } = await supabase
        .from("user_words")
        .select("word,vocabulary_bank_id")
        .eq("user_id", user.id);

      if (learnedError) throw learnedError;

      const learnedWordKeys = new Set((learnedRows ?? []).map((row) => String(row.word).toLowerCase()));
      const learnedVocabularyIds = new Set((learnedRows ?? []).map((row) => row.vocabulary_bank_id).filter(Boolean));

      const { data: bankRows, error: bankError } = await supabase
        .from("vocabulary_bank")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(5000);

      if (bankError) throw bankError;

      const candidates = ((bankRows ?? []) as VocabularyBankWord[]).filter((row) => {
        return !learnedVocabularyIds.has(row.id) && !learnedWordKeys.has(row.word.toLowerCase());
      });

      if (candidates.length < DAILY_WORD_COUNT) {
        throw new Error(`可抽取的新词不足 ${DAILY_WORD_COUNT} 个，请先导入更多词库。`);
      }

      const selected = shuffle(candidates).slice(0, DAILY_WORD_COUNT);
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
            familiarity_level: 0,
            review_count: 0,
            next_review_at: now,
            first_learned_at: now
          }))
        )
        .select("*");

      if (insertError) throw insertError;

      setTodayWords((items) => [...items, ...((inserted ?? []) as UserWord[])]);
      setMessage("已追加生成20个单词");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成今日20词失败");
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }

  function updateRecordedWord(updatedWord: UserWord) {
    setTodayWords((items) => items.map((item) => (item.id === updatedWord.id ? updatedWord : item)));
  }

  return (
    <AppShell>
      <section className="mb-5 rounded border border-stone-200 bg-white p-4">
        <h1 className="mb-2 text-xl font-bold">今日学习</h1>
        <p className="mb-4 text-sm text-stone-600">从词库中随机抽取 20 个未学习单词，加入你的今日学习列表。</p>
        <button
          type="button"
          disabled={generating}
          onClick={generateTodayWords}
          className="w-full rounded bg-sage px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {generating ? "生成中" : "生成今日20词"}
        </button>
        {message ? <p className="mt-3 text-sm text-stone-600">{message}</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">今日抽到的单词</h2>
        {loading ? <p className="rounded border border-stone-200 bg-white p-4 text-center">加载中</p> : null}
        {!loading && !todayWords.length ? <p className="rounded border border-stone-200 bg-white p-4 text-center">今天还没有生成单词</p> : null}
        {todayWords.map((item) => (
          <article key={item.id} className="rounded border border-stone-200 bg-white p-4">
            <h3 className="text-lg font-bold">{item.word}</h3>
            <p className="whitespace-pre-wrap">{item.meaning}</p>
            <WordLearningActions word={item} onRecorded={updateRecordedWord} />
          </article>
        ))}
      </section>
    </AppShell>
  );
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}
