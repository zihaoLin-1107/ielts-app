"use client";

import { useMemo, useState } from "react";
import { addDays } from "@/lib/date";
import { createClient } from "@/lib/supabase-browser";
import type { UserWord } from "@/lib/types";

type ReviewResult = "know" | "vague" | "unknown";

const RESULT_OPTIONS: Array<{
  label: string;
  result: ReviewResult;
  daysUntilReview: number;
  familiarityDelta: number;
  className: string;
}> = [
  {
    label: "认识",
    result: "know",
    daysUntilReview: 7,
    familiarityDelta: 1,
    className: "bg-sage text-white"
  },
  {
    label: "模糊",
    result: "vague",
    daysUntilReview: 3,
    familiarityDelta: 0,
    className: "bg-amber-500 text-white"
  },
  {
    label: "不认识",
    result: "unknown",
    daysUntilReview: 1,
    familiarityDelta: -1,
    className: "bg-rose-600 text-white"
  }
];

type WordLearningActionsProps = {
  word: UserWord;
  onRecorded?: (updatedWord: UserWord) => void;
};

export function WordLearningActions({ word, onRecorded }: WordLearningActionsProps) {
  const supabase = useMemo(() => createClient(), []);
  const [recordedResult, setRecordedResult] = useState<ReviewResult | null>(word.last_review_result ?? null);
  const [savingResult, setSavingResult] = useState<ReviewResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const recorded = Boolean(recordedResult);

  async function recordResult(result: ReviewResult, daysUntilReview: number, familiarityDelta: number) {
    if (recorded || savingResult) return;

    setSavingResult(result);
    setErrorMessage("");

    const now = new Date();
    const nextFamiliarityLevel = Math.max(0, Math.min(5, (word.familiarity_level ?? 0) + familiarityDelta));
    const updatePayload = {
      next_review_at: addDays(now, daysUntilReview).toISOString(),
      last_reviewed_at: now.toISOString(),
      review_count: word.review_count + 1,
      familiarity_level: nextFamiliarityLevel,
      last_review_result: result
    };

    try {
      const { data, error } = await supabase.from("user_words").update(updatePayload).eq("id", word.id).select("*").single();

      if (error) {
        if (error.message.toLowerCase().includes("last_review_result")) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("user_words")
            .update({
              next_review_at: updatePayload.next_review_at,
              last_reviewed_at: updatePayload.last_reviewed_at,
              review_count: updatePayload.review_count,
              familiarity_level: updatePayload.familiarity_level
            })
            .eq("id", word.id)
            .select("*")
            .single();

          if (fallbackError) throw fallbackError;
          const updatedWord = { ...(fallbackData as UserWord), last_review_result: result };
          setRecordedResult(result);
          onRecorded?.(updatedWord);
          return;
        }

        throw error;
      }

      setRecordedResult(result);
      onRecorded?.((data ?? { ...word, ...updatePayload }) as UserWord);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "记录失败");
    } finally {
      setSavingResult(null);
    }
  }

  return (
    <div className="mt-4">
      <div className="grid grid-cols-3 gap-2">
        {RESULT_OPTIONS.map((option) => (
          <button
            key={option.result}
            type="button"
            disabled={recorded || Boolean(savingResult)}
            onClick={() => recordResult(option.result, option.daysUntilReview, option.familiarityDelta)}
            className={`rounded px-2 py-2 text-sm font-semibold disabled:bg-stone-200 disabled:text-stone-500 ${option.className}`}
          >
            {savingResult === option.result ? "记录中" : option.label}
          </button>
        ))}
      </div>
      {recorded ? <p className="mt-2 text-sm text-sage">已记录</p> : null}
      {errorMessage ? <p className="mt-2 text-sm text-rose-600">{errorMessage}</p> : null}
    </div>
  );
}
