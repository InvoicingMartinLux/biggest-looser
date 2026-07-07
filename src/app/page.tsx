"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";

export default function Home() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  return (
    <div className="flex flex-col items-center text-center py-20 gap-8">
      <div className="text-6xl">🏆⚖️</div>
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
        Biggest <span className="text-emerald-400">Looser</span>
      </h1>
      <p className="max-w-xl text-lg text-zinc-400">
        Track your weight, team up with friends, and compete to lose the most weight —
        measured in percentages, so everyone competes on equal footing. Just like the TV show.
      </p>
      <div className="flex gap-4">
        <Link href="/signup" className="btn-primary text-base px-6 py-3">
          Get started
        </Link>
        <Link href="/login" className="btn-secondary text-base px-6 py-3">
          Sign in
        </Link>
      </div>
      <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mt-8 text-left">
        <div className="card">
          <h3 className="font-semibold mb-1">⚖️ Log weigh-ins</h3>
          <p className="text-sm text-zinc-400">Enter your weight daily, weekly or monthly and watch your progress toward your target.</p>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-1">👥 Build teams</h3>
          <p className="text-sm text-zinc-400">Create a team, invite friends by email, and lose weight together.</p>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-1">🥇 Compete</h3>
          <p className="text-sm text-zinc-400">1-vs-1 duels or team-vs-team battles. The biggest percentage lost wins the crown.</p>
        </div>
      </div>
    </div>
  );
}
