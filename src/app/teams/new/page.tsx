"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/lib/useUser";
import Avatar from "@/components/Avatar";
import ImageUpload from "@/components/ImageUpload";

export default function NewTeamPage() {
  const { user, loading } = useRequireUser();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading || !user) return <p className="text-zinc-500">Loading…</p>;

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    const { data: team, error: tErr } = await supabase
      .from("teams")
      .insert({ name: name.trim(), description: description.trim(), image_url: imageUrl, captain_id: user.id })
      .select()
      .single();
    if (tErr || !team) {
      setError(tErr?.message ?? "Failed to create team");
      setBusy(false);
      return;
    }
    const { error: mErr } = await supabase.from("team_members").insert({ team_id: team.id, user_id: user.id });
    if (mErr) {
      setError(mErr.message);
      setBusy(false);
      return;
    }
    router.replace(`/teams/${team.id}`);
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-2">Create a team</h1>
      <p className="text-zinc-400 text-sm mb-6">You&apos;ll be the team captain and can invite members by email.</p>
      <form onSubmit={createTeam} className="card flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar url={imageUrl} name={name || "?"} size={64} />
          <ImageUpload
            bucket="team-images"
            folder={user.id}
            onUploaded={setImageUrl}
            label="Upload team image"
          />
        </div>
        <div>
          <label className="label">Team name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's your team about?"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Creating…" : "Create team"}
        </button>
      </form>
    </div>
  );
}
