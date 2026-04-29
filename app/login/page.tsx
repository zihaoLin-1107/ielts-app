"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup") {
      setMessage("注册成功。如 Supabase 开启邮件确认，请先查收确认邮件。");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="mb-2 text-2xl font-bold">IELTS Vocab</h1>
      <p className="mb-6 text-sm text-stone-600">每天 1.5 小时，以单词驱动雅思训练。</p>
      <form onSubmit={submit} className="space-y-3 rounded border border-stone-200 bg-white p-4">
        <input
          className="w-full rounded border border-stone-300 px-3 py-3"
          type="email"
          required
          placeholder="邮箱"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="w-full rounded border border-stone-300 px-3 py-3"
          type="password"
          required
          minLength={6}
          placeholder="密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="w-full rounded bg-sage px-4 py-3 font-semibold text-white">
          {mode === "login" ? "登录" : "注册"}
        </button>
        <button
          type="button"
          className="w-full rounded border border-stone-300 px-4 py-3 text-sm"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          切换到{mode === "login" ? "注册" : "登录"}
        </button>
        {message ? <p className="text-sm text-stone-600">{message}</p> : null}
      </form>
    </main>
  );
}
