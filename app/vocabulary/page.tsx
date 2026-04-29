"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase-browser";
import type { VocabularyBankWord } from "@/lib/types";

export default function VocabularyPage() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<VocabularyBankWord[]>([]);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [editing, setEditing] = useState<VocabularyBankWord | null>(null);

  const loadItems = useCallback(async () => {
    const { data } = await supabase.from("vocabulary_bank").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as VocabularyBankWord[]);
  }, [supabase]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const tags = useMemo(() => Array.from(new Set(items.flatMap((item) => item.tags ?? []))).sort(), [items]);
  const difficulties = useMemo(() => Array.from(new Set(items.map((item) => item.difficulty_level).filter((item) => item !== null))).sort((a, b) => Number(a) - Number(b)), [items]);
  const filtered = items.filter((item) => {
    const matchesQuery = [item.word, item.meaning, item.source ?? ""].join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesTag = tag ? item.tags?.includes(tag) : true;
    const matchesDifficulty = difficulty ? String(item.difficulty_level) === difficulty : true;
    return matchesQuery && matchesTag && matchesDifficulty;
  });

  async function remove(id: string) {
    if (!confirm("删除这个词库单词？已进入学习系统的关联单词也会因数据库外键级联删除。")) return;
    await supabase.from("vocabulary_bank").delete().eq("id", id);
    await loadItems();
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    await supabase
      .from("vocabulary_bank")
      .update({
        word: editing.word,
        meaning: editing.meaning,
        example_sentence: editing.example_sentence,
        source: editing.source,
        tags: editing.tags,
        difficulty_level: editing.difficulty_level,
        is_active: editing.is_active
      })
      .eq("id", editing.id);
    setEditing(null);
    await loadItems();
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">词库</h1>
        <Link href="/vocabulary/import" className="rounded bg-sage px-3 py-2 text-sm font-semibold text-white">导入</Link>
      </div>
      <div className="mb-4 grid gap-2">
        <input className="rounded border border-stone-300 bg-white px-3 py-3" placeholder="搜索 word / meaning / source" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <select className="rounded border border-stone-300 bg-white px-3 py-3" value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="">全部标签</option>
            {tags.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="rounded border border-stone-300 bg-white px-3 py-3" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option value="">全部难度</option>
            {difficulties.map((item) => <option key={item} value={String(item)}>{item}</option>)}
          </select>
        </div>
      </div>
      <section className="space-y-3">
        {filtered.map((item) => (
          <article key={item.id} className="rounded border border-stone-200 bg-white p-4">
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold">{item.word}</h2>
              <div className="flex gap-2 text-sm">
                <button onClick={() => setEditing(item)} className="text-sage">编辑</button>
                <button onClick={() => remove(item.id)} className="text-rose-600">删除</button>
              </div>
            </div>
            <p className="whitespace-pre-wrap">{item.meaning}</p>
            {item.example_sentence ? <p className="mt-2 text-sm text-stone-600">{item.example_sentence}</p> : null}
            <p className="mt-2 text-xs text-stone-500">
              {[item.source, item.tags?.join(" / "), item.difficulty_level ? `难度 ${item.difficulty_level}` : ""].filter(Boolean).join(" · ")}
            </p>
          </article>
        ))}
        {!filtered.length ? <p className="rounded border border-stone-200 bg-white p-4 text-center">暂无词库单词</p> : null}
      </section>
      {editing ? (
        <div className="fixed inset-0 overflow-y-auto bg-black/30 p-4">
          <form onSubmit={saveEdit} className="mx-auto mt-10 max-w-md space-y-3 rounded bg-white p-4">
            <input className="w-full rounded border px-3 py-3" value={editing.word} onChange={(event) => setEditing({ ...editing, word: event.target.value })} />
            <textarea className="min-h-24 w-full rounded border px-3 py-3" value={editing.meaning} onChange={(event) => setEditing({ ...editing, meaning: event.target.value })} />
            <textarea className="min-h-20 w-full rounded border px-3 py-3" value={editing.example_sentence ?? ""} onChange={(event) => setEditing({ ...editing, example_sentence: event.target.value })} />
            <input className="w-full rounded border px-3 py-3" value={editing.source ?? ""} onChange={(event) => setEditing({ ...editing, source: event.target.value })} />
            <input className="w-full rounded border px-3 py-3" value={editing.tags?.join(", ") ?? ""} onChange={(event) => setEditing({ ...editing, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
            <input className="w-full rounded border px-3 py-3" type="number" value={editing.difficulty_level ?? ""} onChange={(event) => setEditing({ ...editing, difficulty_level: event.target.value ? Number(event.target.value) : null })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.is_active} onChange={(event) => setEditing({ ...editing, is_active: event.target.checked })} />
              启用
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded border px-4 py-3">取消</button>
              <button className="rounded bg-sage px-4 py-3 font-semibold text-white">保存</button>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
