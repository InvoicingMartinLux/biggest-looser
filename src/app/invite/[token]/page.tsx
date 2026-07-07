"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import type { Team } from "@/lib/types";

interface InviteInfo {
  found: boolean;
  kind?: "team" | "competition";
  status?: string;
  email?: string;
  team_name?: string | null;
  competition_name?: string | null;
  competition_type?: "solo" | "team" | null;
  inviter_name?: string | null;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useUser();
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase.rpc("get_invite", { invite_token: token }).then(({ data, error }) => {
      if (error) setError(error.message);
      else setInfo(data as InviteInfo);
    });
  }, [token]);

  const needsTeamChoice = info?.kind === "competition" && info?.competition_type === "team";

  useEffect(() => {
    if (!user || !needsTeamChoice) return;
    supabase
      .from("teams")
      .select("*")
      .eq("captain_id", user.id)
      .then(({ data }) => {
        setMyTeams(data ?? []);
        if (data?.length) setTeamId(data[0].id);
      });
  }, [user, needsTeamChoice]);

  if (loading || (!info && !error)) return <p className="text-zinc-500">Loading…</p>;
  if (error && !info) return <p className="text-red-400">{error}</p>;
  if (!info?.found)
    return (
      <div className="max-w-md mx-auto card text-center mt-12">
        <p className="text-4xl mb-3">🤷</p>
        <p className="text-zinc-300">This invitation link is invalid or has been removed.</p>
      </div>
    );

  const title =
    info.kind === "team"
      ? `join the team "${info.team_name}"`
      : `compete in "${info.competition_name}"${info.competition_type === "team" ? " (team vs team)" : " (1 vs 1)"}`;

  async function accept() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("accept_invite", {
      invite_token: token,
      join_team_id: needsTeamChoice ? teamId || null : null,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    const res = data as { ok: boolean; error?: string; kind?: string; team_id?: string; competition_id?: string };
    if (!res.ok) {
      setError(res.error ?? "Could not accept invite");
      setBusy(false);
      return;
    }
    router.replace(res.kind === "team" ? `/teams/${res.team_id}` : `/competitions/${res.competition_id}`);
  }

  async function decline() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("decline_invite", { invite_token: token });
    if (error) setError(error.message);
    else if (!(data as { ok: boolean }).ok) setError((data as { error?: string }).error ?? "Failed");
    else router.replace("/dashboard");
    setBusy(false);
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="card text-center flex flex-col gap-4">
        <p className="text-5xl">💌</p>
        <h1 className="text-xl font-bold">
          {info.inviter_name || "Someone"} invited you to {title}
        </h1>
        {info.status !== "pending" ? (
          <p className="text-zinc-400">This invitation was already {info.status}.</p>
        ) : !user ? (
          <>
            <p className="text-sm text-zinc-400">Sign in or create a free account to respond to this invitation.</p>
            <div className="flex gap-3 justify-center">
              <Link href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`} className="btn-primary">
                Sign up
              </Link>
              <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="btn-secondary">
                Sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            {needsTeamChoice && (
              <div className="text-left">
                <label className="label">Join with your team</label>
                {myTeams.length === 0 ? (
                  <p className="text-sm text-amber-400">
                    This is a team competition — you must captain a team to accept.{" "}
                    <Link href="/teams/new" className="underline">
                      Create a team
                    </Link>{" "}
                    first, then open this link again.
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
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 justify-center">
              <button className="btn-primary" onClick={accept} disabled={busy || (needsTeamChoice && !teamId)}>
                {busy ? "Working…" : "Accept invitation"}
              </button>
              <button className="btn-secondary" onClick={decline} disabled={busy}>
                Decline
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
