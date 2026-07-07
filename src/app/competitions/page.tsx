"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/lib/useUser";
import { competitionStatus, formatDate } from "@/lib/competition";
import type { Competition } from "@/lib/types";

interface MyParticipation {
  id: string;
  status: string;
  competitions: Competition;
}

const ORDER = { active: 0, upcoming: 1, finished: 2 } as const;

export default function CompetitionsPage() {
  const { user, loading } = useRequireUser();
  const [participations, setParticipations] = useState<MyParticipation[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: memberships } = await supabase.from("team_members").select("team_id").eq("user_id", user.id);
      const teamIds = (memberships ?? []).map((m) => m.team_id);
      let orFilter = `user_id.eq.${user.id}`;
      if (teamIds.length) orFilter += `,team_id.in.(${teamIds.join(",")})`;
      const { data } = await supabase
        .from("competition_participants")
        .select("id,status,competitions(*)")
        .or(orFilter)
        .eq("status", "accepted");
      const list = ((data as unknown as MyParticipation[]) ?? []).filter(
        (p, i, arr) => arr.findIndex((x) => x.competitions.id === p.competitions.id) === i
      );
      list.sort(
        (a, b) =>
          ORDER[competitionStatus(a.competitions)] - ORDER[competitionStatus(b.competitions)] ||
          a.competitions.start_date.localeCompare(b.competitions.start_date)
      );
      setParticipations(list);
      setLoaded(true);
    })();
  }, [user]);

  if (loading || !user) return <p className="text-zinc-500">Loading…</p>;

  const badge = (c: Competition) => {
    const s = competitionStatus(c);
    const styles = {
      upcoming: "bg-sky-950 text-sky-300",
      active: "bg-emerald-950 text-emerald-300",
      finished: "bg-zinc-800 text-zinc-400",
    } as const;
    return <span className={`text-xs px-2 py-0.5 rounded-full ${styles[s]}`}>{s}</span>;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Competitions</h1>
        <Link href="/competitions/new" className="btn-primary">
          New competition
        </Link>
      </div>
      {!loaded ? (
        <p className="text-zinc-500">Loading…</p>
      ) : participations.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">🥇</p>
          <p className="text-zinc-400 mb-4">No competitions yet. Challenge a friend 1-vs-1 or battle team against team!</p>
          <Link href="/competitions/new" className="btn-primary">
            Start a competition
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {participations.map((p) => (
            <Link
              key={p.competitions.id}
              href={`/competitions/${p.competitions.id}`}
              className="card hover:border-emerald-700 transition-colors flex items-center justify-between gap-4"
            >
              <div>
                <p className="font-semibold">{p.competitions.name}</p>
                <p className="text-sm text-zinc-500">
                  {p.competitions.type === "solo" ? "⚔️ 1 vs 1" : "👥 Team vs team"} ·{" "}
                  {p.competitions.weigh_in_interval} weigh-ins · {formatDate(p.competitions.start_date)} →{" "}
                  {formatDate(p.competitions.end_date)}
                </p>
              </div>
              {badge(p.competitions)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
