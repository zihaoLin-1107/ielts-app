import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

const nav = [
  ["首页", "/"],
  ["词库", "/vocabulary"],
  ["新词", "/daily-words"],
  ["复习", "/review"],
  ["训练包", "/training-packs"]
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-4">
      <header className="mb-5 flex items-center justify-between gap-3">
        <Link href="/" className="text-lg font-bold text-sage">
          IELTS Vocab
        </Link>
        <SignOutButton />
      </header>
      <nav className="mb-5 grid grid-cols-5 gap-2 text-center text-sm">
        {nav.map(([label, href]) => (
          <Link key={href} href={href} className="rounded border border-stone-200 bg-white px-2 py-2">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
