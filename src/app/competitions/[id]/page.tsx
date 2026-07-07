"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/lib/useUser";
import {
  buildPeriods,
  competitionStatus,
  computeEntrant,
  formatDate,
  rankEntrants,
  todayStr,
  weightInRange,
  type EntrantResult,
  type MemberInput,
} from "@/lib/competition";
import { formatPct, formatWeight } from "@/lib/weight";
import type { Competition, CompetitionParticipant, Invite, Profile, Team, WeighIn } from "@/lib/types";
import Avatar from "@/components/Avatar";
import InviteBox from "@/components/InviteBox";

type ParticipantRow = CompetitionParticipant & { profiles: Profile | null; teams: Team | null };
type MemberRow = { team_id: string; user_id: string; profiles: Profile };

export default function CompetitionPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, loading } = useRequireUser();
  const router = useRouter();
  const [comp, setComp] = useState<Competition | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<MemberRow[]>([]);
  const [weighInsByUser, setWeighInsByUser] = useState<Map<string, WeighIn[]>>(new Map());
  const [invites, setInvites] = useState<Invite[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !id) return;
    const [cRes, pRes] = await Promise.all([
      supabase.from("competitions").select("*").eq("id", id).maybeSingle(),
      supabase.from("competition_participants").select("*,profiles(*),teams(*)").eq("competition_id", id),
    ]);
    if (!cRes.data) {
      setNotFound(true);
      return;
    }
    const competition = cRes.data as Competition;
    const parts = (pRes.data as unknown as ParticipantRow[]) ?? [];
    setComp(competition);
    setParticipants(parts);

    const teamIds = parts.filter((p) => p.team_id).map((p) => p.team_id!) as string[];
    let memberRows: MemberRow[] = [];
    if (teamIds.length) {
      const { data } = await supabase
        .from("team_members")
        .select("team_id,user_id,profiles(*)")
        .in("team_id", teamIds);
      memberRows = (data as unknown as MemberRow[]) ?? [];
    }
    setTeamMembers(memberRows);

    const userIds = new Set<string>();
    parts.forEach((p) => p.user_id && userIds.add(p.user_id));
    memberRows.forEach((m) => userIds.add(m.user_id));
    if (userIds.size) {
      const { data: weighIns } = await supabase
        .from("weigh_ins")
        .select("*")
        .in("user_id", [...userIds])
        .lte("measured_on", competition.end_date)
        .order("measured_on", { ascending: true });
      const map = new Map<string, WeighIn[]>();
      (weighIns ?? []).forEach((w) => {
        const arr = map.get(w.user_id) ?? [];
        arr.push(w);
        map.set(w.user_id, arr);
      });
      setWeighInsByUser(map);
    }

    const { data: inv } = await supabase.from("invites").select("*").eq("competition_id", id).eq("status", "pending");
    setInvites(inv ?? []);
  }, [user, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const entrants = useMemo(() => {
    if (!comp) return [];
    const accepted = participants.filter((p) => p.status === "accepted");
    const results: EntrantResult[] = accepted.map((p) => {
      let memberInputs: MemberInput[];
      let base;
      if (p.user_id) {
        memberInputs = [
          {
            userId: p.user_id,
            name: p.profiles?.display_name ?? "Unknown",
            avatarUrl: p.profiles?.avatar_url ?? null,
            weighIns: weighInsByUser.get(p.user_id) ?? [],
          },
        ];
        base = {
          participantId: p.id,
          kind: "user" as const,
          entrantId: p.user_id,
          name: p.profiles?.display_name ?? "Unknown",
          imageUrl: p.profiles?.avatar_url ?? null,
        };
      } else {
        const members = teamMembers.filter((m) => m.team_id === p.team_id);
        memberInputs = members.map((m) => ({
          userId: m.user_id,
          name: m.profiles?.display_name ?? "Unknown",
          avatarUrl: m.profiles?.avatar_url ?? null,
          weighIns: weighInsByUser.get(m.user_id) ?? [],
        }));
        base = {
          participantId: p.id,
          kind: "team" as const,
          entrantId: p.team_id!,
          name: p.teams?.name ?? "Unknown team",
          imageUrl: p.teams?.image_url ?? null,
        };
      }
      return computeEntrant(base, memberInputs, comp);
    });
    return rankEntrants(results);
  }, [comp, participants, teamMembers, weighInsByUser]);

  if (loading || !user) return <p className="text-zinc-500">Loading…</p>;
  if (notFound) return <p className="text-zinc-400">Competition not found.</p>;
  if (!comp) return <p className="text-zinc-500">Loading…</p>;

  const status = competitionStatus(comp);
  const isCreator = comp.creator_id === user.id;
  const unit = profile?.weight_unit ?? "kg";
  const today = todayStr();
  const periods = buildPeriods(comp);
  const currentPeriod = status === "active" ? periods.find((p) => p.start <= today && today <= p.end) : null;
  const completedPeriods = periods.filter((p) => p.end < today).slice(-15).reverse();
  const winner = status === "finished" && entrants.length > 0 && entrants[0].pctLost != null ? entrants[0] : null;
  const acceptedCount = entrants.length;

  const iAmIn =
    participants.some((p) => p.status === "accepted" && p.user_id === user.id) ||
    teamMembers.some((m) => m.user_id === user.id);
  const iEnteredThisPeriod =
    currentPeriod && iAmIn
      ? !!weightInRange(weighInsByUser.get(user.id) ?? [], currentPeriod.start, currentPeriod.end)
      : true;

  async function deleteCompetition() {
    if (!confirm(`Delete competition "${comp!.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("competitions").delete().eq("id", comp!.id);
    if (error) setError(error.message);
    else router.replace("/competitions");
  }

  async function cancelInvite(inviteId: string) {
    await supabase.from("invites").delete().eq("id", inviteId);
    await loadData();
  }

  const statusStyles = {
    upcoming: "bg-sky-950 text-sky-300",
    active: "bg-emerald-950 text-emerald-300",
    finished: "bg-zinc-800 text-zinc-400",
  } as const;

  const medals = ["🥇", "🥈"];

  return (
    <div className="flex flex-col gap-6">
      <div className="card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{comp.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyles[status]}`}>{status}</span>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              {comp.type === "solo" ? "⚔️ 1 vs 1" : "👥 Team vs team"} · {comp.weigh_in_interval} weigh-ins ·{" "}
              {formatDate(comp.start_date)} → {formatDate(comp.end_date)}
            </p>
          </div>
          {isCreator && (
            <button className="btn-danger text-xs" onClick={deleteCompetition}>
              Delete
            </button>
          )}
        </div>
      </div>

      {winner && (
        <div className="card border-amber-600 bg-gradient-to-br from-amber-950/40 to-zinc-900 text-center py-8">
          <p className="text-5xl mb-2">👑</p>
          <h2 className="text-2xl font-bold">
            {winner.name} {winner.kind === "team" ? "win" : "wins"} the competition!
          </h2>
          <p className="text-amber-300 text-lg mt-1 font-semibold">{formatPct(winner.pctLost)} of body weight lost</p>
          <p className="text-sm text-zinc-400 mt-2">The Biggest Looser — crowned {formatDate(comp.end_date)} 🎉</p>
        </div>
      )}

      {currentPeriod && !iEnteredThisPeriod && (
        <div className="card border-amber-800 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-amber-300">
            ⏰ You haven&apos;t logged your weight for {currentPeriod.label} yet ({formatDate(currentPeriod.start)} –{" "}
            {formatDate(currentPeriod.end)}).
          </p>
          <Link href="/dashboard" className="btn-primary text-xs">
            Log weigh-in
          </Link>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-4">📊 Standings {status !== "finished" && "(so far)"}</h2>
        {entrants.length === 0 ? (
          <p className="text-sm text-zinc-500">No participants yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {entrants.map((e, rank) => (
              <div
                key={e.participantId}
                className={`rounded-lg border p-4 ${
                  rank === 0 && e.pctLost != null
                    ? "border-amber-700 bg-amber-950/20"
                    : "border-zinc-800 bg-zinc-950/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{e.pctLost != null ? medals[rank] ?? "" : ""}</span>
                  <Avatar url={e.imageUrl} name={e.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{e.name}</p>
                    <p className="text-xs text-zinc-500">
                      {e.kind === "team" ? `team · ${e.members.length} members` : "solo"}
                      {rank === 0 && e.pctLost != null && status === "active" && " · leading"}
                    </p>
                  </div>
                  <p
                    className={`text-2xl font-bold ${
                      e.pctLost != null && e.pctLost > 0 ? "text-emerald-400" : "text-zinc-400"
                    }`}
                  >
                    {formatPct(e.pctLost)}
                  </p>
                </div>
                <div className="mt-3 text-xs text-zinc-500 flex justify-between">
                  <span>Start: {formatWeight(e.baselineKg, unit)}</span>
                  <span>Now: {formatWeight(e.currentKg, unit)}</span>
                </div>
                {e.kind === "team" && (
                  <ul className="mt-3 border-t border-zinc-800 pt-2 flex flex-col gap-1">
                    {e.members.map((m) => (
                      <li key={m.userId} className="flex items-center gap-2 text-xs text-zinc-400">
                        <Avatar url={m.avatarUrl} name={m.name} size={18} />
                        <span className="flex-1 truncate">{m.name}</span>
                        <span className={m.pctLost != null && m.pctLost > 0 ? "text-emerald-400" : ""}>
                          {formatPct(m.pctLost)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {currentPeriod && entrants.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-1">🗓️ Current interval: {currentPeriod.label}</h2>
          <p className="text-xs text-zinc-500 mb-3">
            {formatDate(currentPeriod.start)} – {formatDate(currentPeriod.end)} · everyone must log a weigh-in in this
            window
          </p>
          <ul className="flex flex-col gap-2">
            {entrants.map((e) => {
              const pr = e.periodResults.find((r) => r.period.index === currentPeriod.index);
              const done = pr ? pr.enteredCount >= pr.memberCount && pr.memberCount > 0 : false;
              return (
                <li key={e.participantId} className="flex items-center gap-3 text-sm">
                  <Avatar url={e.imageUrl} name={e.name} size={28} />
                  <span className="flex-1">{e.name}</span>
                  {e.kind === "team" && pr && (
                    <span className="text-xs text-zinc-500">
                      {pr.enteredCount}/{pr.memberCount} entered
                    </span>
                  )}
                  <span className={done ? "text-emerald-400" : "text-amber-400"}>{done ? "✔ entered" : "⏳ waiting"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {completedPeriods.length > 0 && entrants.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="font-semibold mb-3">🏁 Interval results</h2>
          <p className="text-xs text-zinc-500 mb-3">
            Weight change per {comp.weigh_in_interval === "daily" ? "day" : comp.weigh_in_interval === "weekly" ? "week" : "month"} — the biggest percentage lost wins the interval.
          </p>
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-4 font-medium">Interval</th>
                {entrants.map((e) => (
                  <th key={e.participantId} className="py-2 pr-4 font-medium">
                    {e.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {completedPeriods.map((period) => {
                const results = entrants.map((e) => e.periodResults.find((r) => r.period.index === period.index));
                const best = results.reduce<number | null>((acc, r) => {
                  if (r?.pctFromPrev == null) return acc;
                  return acc == null || r.pctFromPrev > acc ? r.pctFromPrev : acc;
                }, null);
                return (
                  <tr key={period.index} className="border-b border-zinc-800/60">
                    <td className="py-2 pr-4 text-zinc-400">
                      {period.label}
                      <span className="block text-xs text-zinc-600">
                        {formatDate(period.start)} – {formatDate(period.end)}
                      </span>
                    </td>
                    {results.map((r, i) => {
                      const isBest = r?.pctFromPrev != null && best != null && r.pctFromPrev === best && best > 0;
                      return (
                        <td key={entrants[i].participantId} className="py-2 pr-4">
                          {r?.pctFromPrev == null ? (
                            <span className="text-zinc-600">no data</span>
                          ) : (
                            <span className={isBest ? "text-emerald-400 font-semibold" : ""}>
                              {isBest && "🏅 "}
                              {formatPct(r.pctFromPrev)}
                            </span>
                          )}
                          {r && r.memberCount > 1 && (
                            <span className="block text-xs text-zinc-600">
                              {r.enteredCount}/{r.memberCount} weighed in
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isCreator && acceptedCount < 2 && status !== "finished" && (
        <div className="card">
          <h2 className="font-semibold mb-3">🤝 Invite your opponent</h2>
          <InviteBox
            kind="competition"
            competitionId={comp.id}
            onSent={loadData}
            hint={
              comp.type === "solo"
                ? "Invite the person you want to challenge 1-vs-1."
                : "Invite the captain of the opposing team — they choose which of their teams joins."
            }
          />
          {invites.length > 0 && (
            <div className="mt-4">
              <p className="label">Pending invites</p>
              <ul className="flex flex-col gap-1 text-sm">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between text-zinc-400">
                    <span>{inv.email}</span>
                    <button className="text-zinc-600 hover:text-red-400 text-xs" onClick={() => cancelInvite(inv.id)}>
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
