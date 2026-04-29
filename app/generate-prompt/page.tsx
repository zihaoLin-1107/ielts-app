"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { startOfTodayIso } from "@/lib/date";
import { createClient } from "@/lib/supabase-browser";
import type { UserWord } from "@/lib/types";

export default function GeneratePromptPage() {
  const supabase = useMemo(() => createClient(), []);
  const [words, setWords] = useState<UserWord[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const today = startOfTodayIso();
    supabase
      .from("user_words")
      .select("*")
      .or(`first_learned_at.gte.${today},last_reviewed_at.gte.${today}`)
      .order("updated_at", { ascending: false })
      .then(({ data }) => setWords((data ?? []) as UserWord[]));
  }, [supabase]);

  const prompt = useMemo(() => {
    const list = words.map((item, index) => `${index + 1}. ${item.word} - ${item.meaning}`).join("\n");
    return `# IELTS Daily Training Pack Request

## 用户英语水平
- CET-4: 480
- IELTS: 5.0-5.5

## 目标
4个月达到 IELTS 7.0+

## 今日目标单词列表
${list || "今日暂无新增或复习单词。"}

## 生成要求
请基于上面的今日单词，生成一个适合雅思备考初期的每日训练包，必须包含以下四个部分：

### Reading
- 一篇短阅读，主题自然，尽量覆盖今日单词
- 阅读后给 3 个理解问题

### Listening
- 一段可朗读的听力脚本，长度适中
- 给 3 个听力问题

### Speaking
- 3 个 Part 1/Part 2 风格口语题
- 给可模仿的简短回答

### Writing
- 1 个 Task 2 风格写作题
- 给一个简洁提纲

## 难度控制
- 除今日单词外，其他词汇不要超过大学英语四级难度
- 句子不要过长
- 解释清楚，但不要堆砌复杂表达
- 输出 Markdown，使用 Reading / Listening / Speaking / Writing 四个清晰分区`;
  }, [words]);

  async function copy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-bold">导出今日 Prompt</h1>
      <textarea readOnly className="mb-3 min-h-[60vh] w-full rounded border border-stone-300 bg-white px-3 py-3 font-mono text-sm" value={prompt} />
      <button onClick={copy} className="w-full rounded bg-sage px-4 py-3 font-semibold text-white">
        {copied ? "已复制" : "一键复制 Prompt"}
      </button>
    </AppShell>
  );
}
