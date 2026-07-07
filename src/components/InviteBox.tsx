"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function InviteBox({
  kind,
  teamId,
  competitionId,
  hint,
  onSent,
}: {
  kind: "team" | "competition";
  teamId?: string;
  competitionId?: string;
  hint?: string;
  onSent?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ emailSent: boolean; link: string } | null>(null);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Not signed in");
      setBusy(false);
      return;
    }
    const res = await fetch("/api/send-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ kind, team_id: teamId ?? null, competition_id: competitionId ?? null, email }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Failed to send invite");
    } else {
      setResult(body);
      setEmail("");
      onSent?.();
    }
    setBusy(false);
  }

  return (
    <form onSubmit={sendInvite} className="flex flex-col gap-2">
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          type="email"
          required
          placeholder="friend@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn-primary shrink-0" disabled={busy}>
          {busy ? "Sending…" : "Invite"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {result &&
        (result.emailSent ? (
          <p className="text-sm text-emerald-400">Invitation email sent! ✉️</p>
        ) : (
          <div className="text-sm text-amber-400">
            <p>Invite created, but email sending is not configured. Share this link instead:</p>
            <div className="flex gap-2 mt-1">
              <input className="input text-xs" readOnly value={result.link} onFocus={(e) => e.target.select()} />
              <button
                type="button"
                className="btn-secondary text-xs shrink-0"
                onClick={() => navigator.clipboard.writeText(result.link)}
              >
                Copy
              </button>
            </div>
          </div>
        ))}
    </form>
  );
}
