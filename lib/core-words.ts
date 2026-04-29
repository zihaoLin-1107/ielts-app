import { startOfTodayIso } from "@/lib/date";
import type { UserWord } from "@/lib/types";

export const DEFAULT_DAILY_WORD_COUNT = 50;
export const MIN_DAILY_WORD_COUNT = 40;
export const MAX_DAILY_WORD_COUNT = 60;
export const CORE_WORD_COUNT = 20;

export function pickCoreWords(words: UserWord[], targetCount = CORE_WORD_COUNT) {
  const todayStart = new Date(startOfTodayIso()).getTime();

  return [...words]
    .map((word) => ({ word, tieBreaker: Math.random() }))
    .sort((left, right) => {
      const leftIsNewToday = isOnOrAfter(left.word.first_learned_at, todayStart) ? 0 : 1;
      const rightIsNewToday = isOnOrAfter(right.word.first_learned_at, todayStart) ? 0 : 1;
      if (leftIsNewToday !== rightIsNewToday) return leftIsNewToday - rightIsNewToday;

      const familiarityDiff = (left.word.familiarity_level ?? 0) - (right.word.familiarity_level ?? 0);
      if (familiarityDiff !== 0) return familiarityDiff;

      return left.tieBreaker - right.tieBreaker;
    })
    .slice(0, targetCount)
    .map(({ word }) => word);
}

export function applyCoreFlags(words: UserWord[], coreWords: UserWord[]) {
  const coreIds = new Set(coreWords.map((word) => word.id));
  return words.map((word) => ({ ...word, is_core: coreIds.has(word.id) }));
}

function isOnOrAfter(value: string | null | undefined, timestamp: number) {
  if (!value) return false;
  return new Date(value).getTime() >= timestamp;
}
