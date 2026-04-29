"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { startOfTodayIso } from "@/lib/date";
import { createClient } from "@/lib/supabase-browser";
import type { UserWord } from "@/lib/types";

function startOfTomorrowIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
}

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

### 1. Reading
#### Passage
Write one IELTS-style reading passage of 250-350 words.

#### Target Words Used
List the target words used in the passage.

#### Questions
Create 5 questions:
1. True / False / Not Given
2. True / False / Not Given
3. Multiple choice
4. Short answer
5. Sentence completion

#### Answer Key
Provide answers with one-sentence explanations.

### 2. Listening
#### Script
Write one listening script of 2 speakers, suitable for IELTS Section 2 or Section 3.

#### Target Words Used
List the target words used in the script.

#### Questions
Create 5 listening questions:
1. Form completion
2. Form completion
3. Multiple choice
4. Matching
5. Short answer

#### Answer Key
Provide answers and explain briefly.

### 3. Speaking
#### Part 1
Create 4 IELTS Speaking Part 1 questions and sample answers.

#### Part 2
Create 1 cue card and 1 sample answer.

#### Part 3
Create 4 follow-up questions and sample answers.

#### Useful Expressions
List 6 useful expressions based on today's target words.

### 4. Writing
#### Task 2 Question
Create one IELTS Writing Task 2 question related to the themes of today's words.

#### Planning
Provide:
- Position
- Main idea 1
- Main idea 2
- Example
- Possible conclusion

#### Model Paragraph
Write one body paragraph at IELTS 6.0-6.5 level.

#### Target Words Used
List the target words used in the writing section.

### 5. Review
#### Vocabulary Review Table
Create a Markdown table with columns:
| Word | Meaning | Example sentence | Collocation |

#### Mini Quiz
Create 10 fill-in-the-blank questions using today's target words.

#### Mini Quiz Answer Key
Provide the answer key.`;
}

export default function GeneratePromptPage() {
  const supabase = useMemo(() => createClient(), []);
  const [words, setWords] = useState<UserWord[]>([]);
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
        setWords(dedupeWords((data ?? []) as UserWord[]));
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
        <p className="mt-1 text-sm text-stone-600">根据今天学习和复习过的单词，生成可复制到 ChatGPT 的四科训练 Prompt。</p>
      </div>

      <section className="mb-4 rounded border border-stone-200 bg-white p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-stone-500">今日目标单词数量</p>
            <p className="text-3xl font-bold text-sage">{loading ? "-" : words.length}</p>
          </div>
          {message ? <p className="text-sm text-stone-600">{message}</p> : null}
        </div>
      </section>

      <section className="mb-4 rounded border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-bold">今日目标单词列表</h2>
        {loading ? <p className="text-sm text-stone-600">加载中</p> : null}
        {!loading && !words.length ? <p className="text-sm text-stone-600">今天还没有学习或复习记录。</p> : null}
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
