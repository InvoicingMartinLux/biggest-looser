"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import Avatar from "./Avatar";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/competitions", label: "Competitions" },
  { href: "/teams", label: "Teams" },
];

export default function Nav() {
  const { user, profile, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href={user ? "/dashboard" : "/"} className="font-bold text-lg tracking-tight">
          🏆 Biggest <span className="text-emerald-400">Looser</span>
        </Link>
        {user && (
          <nav className="flex gap-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors ${
                  pathname?.startsWith(l.href) ? "bg-zinc-800 text-white" : "text-zinc-400"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <Link href="/profile" className="flex items-center gap-2 hover:opacity-80">
                <Avatar url={profile?.avatar_url} name={profile?.display_name || "?"} size={32} />
              </Link>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.replace("/login");
                }}
                className="text-sm text-zinc-400 hover:text-white"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="text-sm text-zinc-300 hover:text-white">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
