import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase-server";
import type { TrainingPack } from "@/lib/types";

export default async function TrainingPacksPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_training_packs")
    .select("*")
    .order("created_at", { ascending: false });
  const packs = (data ?? []) as TrainingPack[];

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">训练包</h1>
        <Link href="/import-pack" className="rounded bg-sage px-3 py-2 text-sm font-semibold text-white">导入</Link>
      </div>
      <section className="space-y-3">
        {packs.map((pack) => (
          <Link key={pack.id} href={`/training-packs/${pack.id}`} className="block rounded border border-stone-200 bg-white p-4">
            <h2 className="font-bold">{pack.title}</h2>
            <p className="text-sm text-stone-500">{new Date(pack.created_at).toLocaleString()}</p>
          </Link>
        ))}
        {!packs.length ? <p className="rounded border border-stone-200 bg-white p-4 text-center">暂无训练包</p> : null}
      </section>
    </AppShell>
  );
}
