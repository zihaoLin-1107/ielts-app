"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CORE_WORD_COUNT, pickCoreWords } from "@/lib/core-words";
import { startOfTodayIso, startOfTomorrowIso } from "@/lib/date";
import { createClient } from "@/lib/supabase-browser";
import type { UserWord } from "@/lib/types";

function dedupeWords(rows: UserWord[]) {
  const seen = new Set<string>();
  const result: UserWord[] = [];

  rows.forEach((row) => {
    const key = row.word.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(row);
  });

  return result;
}

function buildPrompt(words: UserWord[]) {
  const targetWords = words.map((item, index) => `${index + 1}. **${item.word}** - ${item.meaning}`).join("\n");

  return `# IELTS Daily Four-Skill Training Prompt

## Learner Profile
- My English level: CET-4 score 480; IELTS estimated level 5.0-5.5.
- My goal: reach IELTS 7.0+ in 4 months.
- Today's target word count: ${words.length}

## Today's Target Vocabulary
${targetWords || "- No target words available today."}

## Task
Create one integrated IELTS training pack using today's target vocabulary. The pack must train all four IELTS skills:
- Reading
- Listening
- Speaking
- Writing

## Difficulty Control
- Use today's target words naturally and repeatedly where appropriate.
- Keep non-target new vocabulary at CET-4 level or below.
- Sentences should be clear and not overly long.
- The content should start from my current level and gradually move closer to real IELTS exam style.
- Do not overload the text with advanced academic vocabulary outside the target list.
- If a target word is difficult, make its meaning inferable from context.

## Required Fixed Markdown Output Format

# Daily IELTS Training Pack

## 1. Reading

### Title
Write a clear title.

### Passage
Write a 150-250 word passage. Use today's target words naturally. Do not sacrifice naturalness just to include more words.

### Key Vocabulary Used
- List target words used in the passage.

### Questions
1. Write one comprehension question.
2. Write one detail question.
3. Write one inference or vocabulary-in-context question.

### Answers
1. Provide the answer.
2. Provide the answer.
3. Provide the answer.

---

## 2. Listening

### Script
Write a 60-90 second listening script suitable for reading aloud or later turning into audio.

### Key Vocabulary Used
- List target words used in the script.

### Questions
1. Write one listening question.
2. Write one listening question.
3. Write one listening question.

### Answers
1. Provide the answer.
2. Provide the answer.
3. Provide the answer.

---

## 3. Speaking

### Part 1
1. Write one IELTS Speaking Part 1 question.
2. Write one IELTS Speaking Part 1 question.
3. Write one IELTS Speaking Part 1 question.

### Part 2
Describe a topic related to today's target vocabulary.

### Part 3
1. Write one IELTS Speaking Part 3 question.
2. Write one IELTS Speaking Part 3 question.
3. Write one IELTS Speaking Part 3 question.

### Useful Answer Patterns
- Give useful sentence patterns that I can reuse.

---

## 4. Writing

### Task
Create one small writing task that can be completed in 10-15 minutes.

### Sample Answer
Write a 120-180 word sample answer.

### Useful Expressions
- List useful expressions from or related to today's target words.

---

## 5. Review Task

### Today’s Active Recall
Create 5 active recall questions to help me review today's target words.`;
}

export default function GeneratePromptPage() {
  const supabase = useMemo(() => createClient(), []);
  const [words, setWords] = useState<UserWord[]>([]);
  const [todayTotalCount, setTodayTotalCount] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadWords() {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();

        if (!user) {
          setWords([]);
          setTodayTotalCount(0);
          setMessage("请先登录后生成 Prompt。");
          return;
        }

        const today = startOfTodayIso();
        const tomorrow = startOfTomorrowIso();
        const { data, error } = await supabase
          .from("user_words")
          .select("*")
          .eq("user_id", user.id)
          .or(`and(first_learned_at.gte.${today},first_learned_at.lt.${tomorrow}),and(last_reviewed_at.gte.${today},last_reviewed_at.lt.${tomorrow})`)
          .order("updated_at", { ascending: false });

        if (error) throw error;
        const todayWords = dedupeWords((data ?? []) as UserWord[]);
        const markedCoreWords = todayWords.filter((word) => word.is_core);
        const coreWords = markedCoreWords.length ? markedCoreWords.slice(0, CORE_WORD_COUNT) : pickCoreWords(todayWords);
        setTodayTotalCount(todayWords.length);
        setWords(coreWords);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "加载今日单词失败");
      } finally {
        setLoading(false);
      }
    }

    loadWords();
  }, [supabase]);

  const prompt = useMemo(() => buildPrompt(words), [words]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-xl font-bold">今日 Prompt 导出</h1>
        <p className="mt-1 text-sm text-stone-600">只使用今日核心词生成可复制到 ChatGPT 的四科训练 Prompt。</p>
      </div>

      <section className="mb-4 rounded border border-stone-200 bg-white p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-stone-500">今日总词数</p>
            <p className="text-3xl font-bold text-sage">{loading ? "-" : todayTotalCount}</p>
          </div>
          <div>
            <p className="text-sm text-stone-500">核心词数量</p>
            <p className="text-3xl font-bold text-sage">{loading ? "-" : words.length}</p>
          </div>
          {message ? <p className="text-sm text-stone-600">{message}</p> : null}
        </div>
      </section>

      <section className="mb-4 rounded border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-bold">今日核心词列表</h2>
        {loading ? <p className="text-sm text-stone-600">加载中</p> : null}
        {!loading && !words.length ? <p className="text-sm text-stone-600">今天还没有可导出的核心词。</p> : null}
        {words.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {words.map((item) => (
              <div key={item.id} className="rounded border border-stone-200 p-3">
                <h3 className="font-semibold">{item.word}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{item.meaning}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded border border-stone-200 bg-white p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold">Markdown Prompt</h2>
          <button type="button" onClick={copyPrompt} className="rounded bg-sage px-4 py-2 text-sm font-semibold text-white">
            {copied ? "已复制" : "复制 Prompt"}
          </button>
        </div>
        <textarea
          readOnly
          className="min-h-[55vh] w-full resize-y rounded border border-stone-300 bg-stone-50 px-3 py-3 font-mono text-sm leading-6"
          value={prompt}
        />
      </section>
    </AppShell>
  );
}
