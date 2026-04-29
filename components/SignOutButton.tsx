"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button onClick={signOut} className="rounded border border-stone-300 bg-white px-3 py-2 text-sm">
      登出
    </button>
  );
}
