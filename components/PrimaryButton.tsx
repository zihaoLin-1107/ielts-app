import Link from "next/link";

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded bg-sage px-4 py-3 text-center text-sm font-semibold text-white">
      {children}
    </Link>
  );
}
