import { AppShell } from "@/components/AppShell";
import { PrimaryLink } from "@/components/PrimaryButton";
import { createClient } from "@/lib/supabase-server";
import { startOfTodayIso } from "@/lib/date";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = startOfTodayIso();
  const now = new Date().toISOString();

  const [
    { count: dueCount },
    { count: todayNewCount },
    { count: totalLearningWords },
    { count: totalBankWords },
    { count: packCount }
  ] = await Promise.all([
    supabase.from("user_words").select("id", { count: "exact", head: true }).lte("next_review_at", now),
    supabase.from("user_words").select("id", { count: "exact", head: true }).gte("first_learned_at", today),
    supabase.from("user_words").select("id", { count: "exact", head: true }),
    supabase.from("vocabulary_bank").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("daily_training_packs").select("id", { count: "exact", head: true }).gte("created_at", today)
  ]);

  return (
    <AppShell>
      <section className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="今日待复习" value={dueCount ?? 0} />
        <Stat label="今日新词" value={todayNewCount ?? 0} />
        <Stat label="总学习单词" value={totalLearningWords ?? 0} />
        <Stat label="总词库" value={totalBankWords ?? 0} />
      </section>
      <div className="mb-3 rounded border border-stone-200 bg-white p-3 text-sm text-stone-600">
        今日训练包：{packCount ?? 0}
      </div>
      <section className="grid gap-3">
        <PrimaryLink href="/daily-words">生成今日单词</PrimaryLink>
        <PrimaryLink href="/review">开始复习</PrimaryLink>
        <PrimaryLink href="/generate-prompt">导出今日 Prompt</PrimaryLink>
        <PrimaryLink href="/import-pack">导入训练包</PrimaryLink>
        <PrimaryLink href="/training-packs">查看训练包</PrimaryLink>
        <PrimaryLink href="/vocabulary/import">导入词库</PrimaryLink>
        <PrimaryLink href="/vocabulary">查看词库</PrimaryLink>
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-stone-200 bg-white p-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-stone-600">{label}</div>
    </div>
  );
}
