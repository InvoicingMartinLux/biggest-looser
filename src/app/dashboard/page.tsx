"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/lib/useUser";
import { formatWeight, kgToUnit, unitToKg } from "@/lib/weight";
import { competitionStatus, formatDate, todayStr } from "@/lib/competition";
import type { Competition, Invite, WeighIn } from "@/lib/types";
import WeightChart from "@/components/WeightChart";

interface MyParticipation {
  id: string;
  status: string;
  competitions: Competition;
}

export default function DashboardPage() {
  const { user, profile, loading } = useRequireUser();
  const [weighIns, setWeighIns] = useState<WeighIn[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [participations, setParticipations] = useState<MyParticipation[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [dateInput, setDateInput] = useState(todayStr());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const unit = profile?.weight_unit ?? "kg";

  const loadData = useCallback(async () => {
    if (!user) return;
    const [wRes, iRes, tRes] = await Promise.all([
      supabase.from("weigh_ins").select("*").eq("user_id", user.id).order("measured_on", { ascending: true }),
      supabase
        .from("invites")
        .select("*")
        .eq("status", "pending")
        .ilike("email", user.email ?? "")
        .order("created_at", { ascending: false }),
      supabase.from("team_members").select("team_id").eq("user_id", user.id),
    ]);
    setWeighIns(wRes.data ?? []);
    setInvites(iRes.data ?? []);

    const teamIds = (tRes.data ?? []).map((t) => t.team_id);
    let orFilter = `user_id.eq.${user.id}`;
    if (teamIds.length) orFilter += `,team_id.in.(${teamIds.join(",")})`;
    const { data: parts } = await supabase
      .from("competition_participants")
      .select("id,status,competitions(*)")
      .or(orFilter)
      .eq("status", "accepted");
    setParticipations((parts as unknown as MyParticipation[]) ?? []);
    setDataLoaded(true);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading || !user) return <p className="text-zinc-500">Loading…</p>;
  if (dataLoaded && profile && !profile.target_weight_kg && weighIns.length === 0) {
    // brand-new account — nudge through onboarding
  }

  const latest = weighIns.length ? weighIns[weighIns.length - 1] : null;
  const first = weighIns.length ? weighIns[0] : null;
  const totalLostKg = first && latest ? Number(first.weight_kg) - Number(latest.weight_kg) : null;
  const totalLostPct = first && latest ? ((Number(first.weight_kg) - Number(latest.weight_kg)) / Number(first.weight_kg)) * 100 : null;

  async function addWeighIn(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    const kg = unitToKg(parseFloat(weightInput), unit);
    const { error } = await supabase
      .from("weigh_ins")
      .upsert({ user_id: user.id, weight_kg: kg, measured_on: dateInput }, { onConflict: "user_id,measured_on" });
    if (error) setError(error.message);
    else {
      setWeightInput("");
      await loadData();
    }
    setBusy(false);
  }

  async function deleteWeighIn(id: string) {
    await supabase.from("weigh_ins").delete().eq("id", id);
    await loadData();
  }

  const statusBadge = (c: Competition) => {
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Hi {profile?.display_name || "there"} 👋</h1>
        {profile && weighIns.length === 0 && (
          <Link href="/onboarding" className="btn-secondary text-sm">
            Finish profile setup
          </Link>
        )}
      </div>

      {invites.length > 0 && (
        <div className="card border-emerald-800">
          <h2 className="font-semibold mb-3">📨 Pending invitations</h2>
          <ul className="flex flex-col gap-2">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-300">
                  {inv.kind === "team" ? "Team invitation" : "Competition invitation"}
                </span>
                <Link href={`/invite/${inv.token}`} className="btn-primary text-xs px-3 py-1.5">
                  View invite
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-zinc-400">Current weight</p>
          <p className="text-2xl font-bold">{formatWeight(latest ? Number(latest.weight_kg) : null, unit)}</p>
          {latest && <p className="text-xs text-zinc-500 mt-1">on {formatDate(latest.measured_on)}</p>}
        </div>
        <div className="card">
          <p className="text-sm text-zinc-400">Target weight</p>
          <p className="text-2xl font-bold">{formatWeight(profile?.target_weight_kg ?? null, unit)}</p>
          {latest && profile?.target_weight_kg != null && (
            <p className="text-xs text-zinc-500 mt-1">
              {formatWeight(Math.max(0, Number(latest.weight_kg) - profile.target_weight_kg), unit)} to go
            </p>
          )}
        </div>
        <div className="card">
          <p className="text-sm text-zinc-400">Total lost</p>
          <p className={`text-2xl font-bold ${totalLostKg != null && totalLostKg > 0 ? "text-emerald-400" : ""}`}>
            {totalLostKg != null ? `${kgToUnit(totalLostKg, unit).toFixed(1)} ${unit}` : "—"}
          </p>
          {totalLostPct != null && (
            <p className="text-xs text-zinc-500 mt-1">{totalLostPct.toFixed(2)} % since you started</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <form onSubmit={addWeighIn} className="card flex flex-col gap-4">
          <h2 className="font-semibold">⚖️ Log a weigh-in</h2>
          <div>
            <label className="label">Weight ({unit})</label>
            <input
              className="input"
              type="number"
              step="0.1"
              min="1"
              required
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder={latest ? kgToUnit(Number(latest.weight_kg), unit).toFixed(1) : ""}
            />
          </div>
          <div>
            <label className="label">Date</label>
            <input
              className="input"
              type="date"
              required
              max={todayStr()}
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save weigh-in"}
          </button>
          {weighIns.length > 0 && (
            <div>
              <p className="label mt-2">Recent entries</p>
              <ul className="text-sm flex flex-col gap-1">
                {[...weighIns]
                  .slice(-5)
                  .reverse()
                  .map((w) => (
                    <li key={w.id} className="flex justify-between items-center text-zinc-300">
                      <span>
                        {formatDate(w.measured_on)} — {formatWeight(Number(w.weight_kg), unit)}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteWeighIn(w.id)}
                        className="text-zinc-600 hover:text-red-400 text-xs"
                        title="Delete entry"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </form>

        <div className="card lg:col-span-2">
          <h2 className="font-semibold mb-3">📉 Your progress</h2>
          <WeightChart
            points={weighIns.map((w) => ({ date: w.measured_on, kg: Number(w.weight_kg) }))}
            unit={unit}
            targetKg={profile?.target_weight_kg}
          />
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">🥇 Your competitions</h2>
          <Link href="/competitions/new" className="btn-secondary text-xs">
            New competition
          </Link>
        </div>
        {participations.length === 0 ? (
          <p className="text-sm text-zinc-500">
            You&apos;re not in any competition yet.{" "}
            <Link href="/competitions/new" className="text-emerald-400 hover:underline">
              Start one
            </Link>{" "}
            and challenge a friend or another team!
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {participations.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/competitions/${p.competitions.id}`}
                  className="flex items-center justify-between py-3 hover:bg-zinc-800/50 px-2 rounded-md"
                >
                  <div>
                    <p className="font-medium">{p.competitions.name}</p>
                    <p className="text-xs text-zinc-500">
                      {p.competitions.type === "solo" ? "1 vs 1" : "Team vs team"} · {p.competitions.weigh_in_interval}{" "}
                      weigh-ins · {formatDate(p.competitions.start_date)} → {formatDate(p.competitions.end_date)}
                    </p>
                  </div>
                  {statusBadge(p.competitions)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
