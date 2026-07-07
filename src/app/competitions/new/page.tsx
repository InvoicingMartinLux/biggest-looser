"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/lib/useUser";
import { addDays, todayStr } from "@/lib/competition";
import type { CompetitionType, Team, WeighInInterval } from "@/lib/types";

export default function NewCompetitionPage() {
  const { user, loading } = useRequireUser();
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<CompetitionType>("solo");
  const [interval, setIntervalValue] = useState<WeighInInterval>("weekly");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(addDays(todayStr(), 28));
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("teams")
      .select("*")
      .eq("captain_id", user.id)
      .then(({ data }) => {
        setMyTeams(data ?? []);
        if (data?.length) setTeamId(data[0].id);
      });
  }, [user]);

  if (loading || !user) return <p className="text-zinc-500">Loading…</p>;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    if (endDate <= startDate) {
      setError("End date must be after the start date.");
      return;
    }
    if (type === "team" && !teamId) {
      setError("Create a team first — you need to captain a team to enter a team competition.");
      return;
    }
    setBusy(true);
    const { data: comp, error: cErr } = await supabase
      .from("competitions")
      .insert({
        name: name.trim(),
        type,
        weigh_in_interval: interval,
        start_date: startDate,
        end_date: endDate,
        creator_id: user.id,
      })
      .select()
      .single();
    if (cErr || !comp) {
      setError(cErr?.message ?? "Failed to create competition");
      setBusy(false);
      return;
    }
    const participant = {
      competition_id: comp.id,
      user_id: type === "solo" ? user.id : null,
      team_id: type === "solo" ? null : teamId,
      status: "accepted",
    };
    const { error: pErr } = await supabase.from("competition_participants").insert(participant);
    if (pErr) {
      setError(pErr.message);
      setBusy(false);
      return;
    }
    router.replace(`/competitions/${comp.id}`);
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-2">New competition</h1>
      <p className="text-zinc-400 text-sm mb-6">
        Set up the rules, then invite your opponent — a single rival or another team.
      </p>
      <form onSubmit={create} className="card flex flex-col gap-5">
        <div>
          <label className="label">Competition name</label>
          <input
            className="input"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Summer shred 2026"
          />
        </div>
        <div>
          <label className="label">Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("solo")}
              className={`btn ${type === "solo" ? "bg-emerald-600 text-white" : "border border-zinc-700 text-zinc-300"}`}
            >
              ⚔️ Solo (1 vs 1)
            </button>
            <button
              type="button"
              onClick={() => setType("team")}
              className={`btn ${type === "team" ? "bg-emerald-600 text-white" : "border border-zinc-700 text-zinc-300"}`}
            >
              👥 Team vs team
            </button>
          </div>
        </div>
        {type === "team" && (
          <div>
            <label className="label">Your team</label>
            {myTeams.length === 0 ? (
              <p className="text-sm text-amber-400">
                You don&apos;t captain any team yet — create one on the Teams page first.
              </p>
            ) : (
              <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {myTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <div>
          <label className="label">Weigh-in interval</label>
          <select className="input" value={interval} onChange={(e) => setIntervalValue(e.target.value as WeighInInterval)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <p className="text-xs text-zinc-500 mt-1">How often every participant must enter their weight.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start date</label>
            <input className="input" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">End date</label>
            <input className="input" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary" disabled={busy || (type === "team" && myTeams.length === 0)}>
          {busy ? "Creating…" : "Create competition"}
        </button>
      </form>
    </div>
  );
}
