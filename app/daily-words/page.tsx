"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { WordLearningActions } from "@/components/WordLearningActions";
import { applyCoreFlags, CORE_WORD_COUNT, DEFAULT_DAILY_WORD_COUNT, MAX_DAILY_WORD_COUNT, MIN_DAILY_WORD_COUNT, pickCoreWords } from "@/lib/core-words";
import { startOfTodayIso } from "@/lib/date";
import { createClient } from "@/lib/supabase-browser";
import type { UserWord, VocabularyBankWord } from "@/lib/types";

function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags === "string") {
    return tags
      .replace(/^[{[]|[}\]]$/g, "")
      .split(/[,/，]+/)
      .map((tag) => tag.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }

  return [];
}

export default function DailyWordsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState(DEFAULT_DAILY_WORD_COUNT);
  const [todayWords, setTodayWords] = useState<UserWord[]>([]);
  const [reviewWords, setReviewWords] = useState<UserWord[]>([]);
  const [totalLearningWords, setTotalLearningWords] = useState(0);
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
        setTodayWords([]);
        setReviewWords([]);
        setTotalLearningWords(0);
        setMessage("请先登录");
        return;
      }

      const now = new Date().toISOString();
      const today = startOfTodayIso();
      const [{ data: todayData, error: todayError }, { data: reviewData, error: reviewError }, { count: totalCount, error: totalError }] = await Promise.all([
        supabase.from("user_words").select("*").eq("user_id", user.id).gte("first_learned_at", today).order("first_learned_at", { ascending: true }),
        supabase
          .from("user_words")
          .select("*")
          .eq("user_id", user.id)
          .lte("next_review_at", now)
          .order("next_review_at", { ascending: true })
          .limit(50),
        supabase.from("user_words").select("id", { count: "exact", head: true }).eq("user_id", user.id)
      ]);

      if (todayError) throw todayError;
      if (reviewError) throw reviewError;
      if (totalError) throw totalError;

      const todayRows = (todayData ?? []) as UserWord[];
      const withCoreFlags = await ensureCoreWords(user.id, todayRows);
      setTodayWords(withCoreFlags);
      setReviewWords((reviewData ?? []) as UserWord[]);
      setTotalLearningWords(totalCount ?? 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
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

      const { data: learnedRows } = await supabase.from("user_words").select("word,vocabulary_bank_id").eq("user_id", user.id);
      const learnedIds = new Set((learnedRows ?? []).map((row) => row.vocabulary_bank_id));
      const learnedWordKeys = new Set((learnedRows ?? []).map((row) => String(row.word).toLowerCase()));

      const { data: bankRows, error } = await supabase
        .from("vocabulary_bank")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("difficulty_level", { ascending: true, nullsFirst: false })
        .limit(5000);

      if (error) throw error;

      const candidates = ((bankRows ?? []) as VocabularyBankWord[]).filter((row) => !learnedIds.has(row.id) && !learnedWordKeys.has(row.word.toLowerCase()));
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
            is_core: false,
            familiarity_level: 0,
            review_count: 0,
            first_learned_at: now,
            next_review_at: now
          }))
        )
        .select("*");

      if (insertError) {
        if (!insertError.message.toLowerCase().includes("is_core")) throw insertError;

        const { data: fallbackInserted, error: fallbackError } = await supabase
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
              first_learned_at: now,
              next_review_at: now
            }))
          )
          .select("*");

        if (fallbackError) throw fallbackError;
        const combined = [...todayWords, ...((fallbackInserted ?? []) as UserWord[])];
        setTodayWords(applyCoreFlags(combined, pickCoreWords(combined)));
        setTotalLearningWords((value) => value + (fallbackInserted?.length ?? 0));
        setMessage(`已追加生成 ${fallbackInserted?.length ?? 0} 个今日新词。`);
        return;
      }

      const combined = [...todayWords, ...((inserted ?? []) as UserWord[])];
      const withCoreFlags = await ensureCoreWords(user.id, combined);
      setTodayWords(withCoreFlags);
      setTotalLearningWords((value) => value + (inserted?.length ?? 0));
      setMessage(`已追加生成 ${inserted?.length ?? 0} 个今日新词。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  }

  function updateRecordedWord(updatedWord: UserWord) {
    setTodayWords((items) => items.map((item) => (item.id === updatedWord.id ? updatedWord : item)));
    setReviewWords((items) =>
      items
        .map((item) => (item.id === updatedWord.id ? updatedWord : item))
        .filter((item) => item.id !== updatedWord.id || !updatedWord.next_review_at || new Date(updatedWord.next_review_at) <= new Date())
    );
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-bold">今日单词</h1>
      <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="今日总词数" value={todayWords.length} />
        <Stat label="核心词" value={todayWords.filter((word) => word.is_core).length} />
        <Stat label="今日待复习" value={reviewWords.length} />
        <Stat label="总学习词数" value={totalLearningWords} />
      </section>
      <section className="mb-4 rounded border border-stone-200 bg-white p-4">
        <label className="mb-3 block text-sm font-medium">
          抽取数量
          <input
            className="mt-1 w-full rounded border border-stone-300 px-3 py-3"
            type="number"
            min={MIN_DAILY_WORD_COUNT}
            max={MAX_DAILY_WORD_COUNT}
            value={count}
            onChange={(event) => setCount(Math.max(MIN_DAILY_WORD_COUNT, Math.min(MAX_DAILY_WORD_COUNT, Number(event.target.value) || DEFAULT_DAILY_WORD_COUNT)))}
          />
        </label>
        <button disabled={generating} onClick={generate} className="w-full rounded bg-sage px-4 py-3 font-semibold text-white disabled:opacity-60">
          {generating ? "生成中" : todayWords.length ? "继续生成今日单词" : "生成今日单词"}
        </button>
        {message ? <p className="mt-3 text-sm text-stone-600">{message}</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">今日新词</h2>
        {loading ? <p className="rounded border border-stone-200 bg-white p-4 text-center">加载中</p> : null}
        {todayWords.map((item) => (
          <article key={item.id} className={`rounded border bg-white p-4 ${item.is_core ? "border-sage shadow-sm" : "border-stone-200 opacity-70"}`}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{item.word}</h2>
              {item.is_core ? <span className="rounded bg-sage px-2 py-1 text-xs font-semibold text-white">核心词</span> : <span className="text-xs text-stone-400">覆盖词</span>}
            </div>
            <p className="whitespace-pre-wrap">{item.meaning}</p>
            {item.example_sentence ? <p className="mt-2 text-sm text-stone-600">{item.example_sentence}</p> : null}
            {normalizeTags(item.tags).length ? <p className="mt-2 text-xs text-stone-500">{normalizeTags(item.tags).join(" / ")}</p> : null}
            <WordLearningActions word={item} onRecorded={updateRecordedWord} />
          </article>
        ))}
        {!loading && !todayWords.length ? <p className="rounded border border-stone-200 bg-white p-4 text-center">今天还没有生成新词</p> : null}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-bold">今日待复习词</h2>
        {reviewWords.map((item) => (
          <article key={item.id} className="rounded border border-stone-200 bg-white p-4">
            <h2 className="text-lg font-bold">{item.word}</h2>
            <p className="whitespace-pre-wrap">{item.meaning}</p>
            {item.example_sentence ? <p className="mt-2 text-sm text-stone-600">{item.example_sentence}</p> : null}
            <WordLearningActions word={item} onRecorded={updateRecordedWord} />
          </article>
        ))}
        {!loading && !reviewWords.length ? <p className="rounded border border-stone-200 bg-white p-4 text-center">今天没有待复习词</p> : null}
      </section>
    </AppShell>
  );
}

async function ensureCoreWords(userId: string, words: UserWord[]) {
  const coreWords = pickCoreWords(words);
  const coreIds = coreWords.map((word) => word.id);
  const nonCoreIds = words.map((word) => word.id).filter((id) => !coreIds.includes(id));

  try {
    if (nonCoreIds.length) {
      await createClient().from("user_words").update({ is_core: false }).eq("user_id", userId).in("id", nonCoreIds);
    }

    if (coreIds.length) {
      const { error } = await createClient().from("user_words").update({ is_core: true }).eq("user_id", userId).in("id", coreIds);
      if (error) throw error;
    }
  } catch (error) {
    const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
    if (!message.toLowerCase().includes("is_core")) {
      throw error;
    }
  }

  return applyCoreFlags(words, coreWords);
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-stone-200 bg-white p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-stone-600">{label}</div>
    </div>
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
