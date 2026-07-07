"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/lib/useUser";
import type { Team } from "@/lib/types";
import Avatar from "@/components/Avatar";

export default function TeamsPage() {
  const { user, loading } = useRequireUser();
  const [teams, setTeams] = useState<(Team & { memberCount: number })[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: memberships } = await supabase.from("team_members").select("team_id").eq("user_id", user.id);
      const ids = (memberships ?? []).map((m) => m.team_id);
      if (ids.length === 0) {
        setTeams([]);
        setLoaded(true);
        return;
      }
      const [{ data: teams }, { data: counts }] = await Promise.all([
        supabase.from("teams").select("*").in("id", ids).order("created_at"),
        supabase.from("team_members").select("team_id").in("team_id", ids),
      ]);
      const countMap = new Map<string, number>();
      (counts ?? []).forEach((c) => countMap.set(c.team_id, (countMap.get(c.team_id) ?? 0) + 1));
      setTeams((teams ?? []).map((t) => ({ ...t, memberCount: countMap.get(t.id) ?? 0 })));
      setLoaded(true);
    })();
  }, [user]);

  if (loading || !user) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your teams</h1>
        <Link href="/teams/new" className="btn-primary">
          Create team
        </Link>
      </div>
      {!loaded ? (
        <p className="text-zinc-500">Loading…</p>
      ) : teams.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-zinc-400 mb-4">You&apos;re not in any team yet. Create one and invite your friends!</p>
          <Link href="/teams/new" className="btn-primary">
            Create your first team
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {teams.map((t) => (
            <Link key={t.id} href={`/teams/${t.id}`} className="card hover:border-emerald-700 transition-colors">
              <div className="flex items-center gap-4">
                <Avatar url={t.image_url} name={t.name} size={56} />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{t.name}</p>
                  <p className="text-sm text-zinc-400 truncate">{t.description || "No description"}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
                    {t.captain_id === user.id && " · you are captain"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
