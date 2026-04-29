import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase-server";
import type { TrainingPack } from "@/lib/types";

export default async function TrainingPackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("daily_training_packs").select("*").eq("id", id).single();
  if (!data) notFound();
  const pack = data as TrainingPack;

  return (
    <AppShell>
      <h1 className="mb-1 text-xl font-bold">{pack.title}</h1>
      <p className="mb-4 text-sm text-stone-500">{new Date(pack.created_at).toLocaleString()}</p>
      <article className="prose-section rounded border border-stone-200 bg-white p-4">
        <ReactMarkdown>{pack.content_markdown}</ReactMarkdown>
      </article>
    </AppShell>
  );
}
