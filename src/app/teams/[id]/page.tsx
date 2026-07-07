"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/lib/useUser";
import type { Invite, Profile, Team } from "@/lib/types";
import Avatar from "@/components/Avatar";
import ImageUpload from "@/components/ImageUpload";
import InviteBox from "@/components/InviteBox";

interface Member {
  user_id: string;
  joined_at: string;
  profiles: Profile;
}

export default function TeamPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useRequireUser();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !id) return;
    const [tRes, mRes, iRes] = await Promise.all([
      supabase.from("teams").select("*").eq("id", id).maybeSingle(),
      supabase.from("team_members").select("user_id,joined_at,profiles(*)").eq("team_id", id).order("joined_at"),
      supabase.from("invites").select("*").eq("team_id", id).eq("status", "pending"),
    ]);
    if (!tRes.data) {
      setNotFound(true);
      return;
    }
    setTeam(tRes.data);
    setMembers((mRes.data as unknown as Member[]) ?? []);
    setInvites(iRes.data ?? []);
    setEditName(tRes.data.name);
    setEditDescription(tRes.data.description);
    setEditImageUrl(tRes.data.image_url);
  }, [user, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading || !user) return <p className="text-zinc-500">Loading…</p>;
  if (notFound) return <p className="text-zinc-400">Team not found.</p>;
  if (!team) return <p className="text-zinc-500">Loading…</p>;

  const isCaptain = team.captain_id === user.id;
  const isMember = members.some((m) => m.user_id === user.id);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase
      .from("teams")
      .update({ name: editName.trim(), description: editDescription.trim(), image_url: editImageUrl })
      .eq("id", team!.id);
    if (error) setError(error.message);
    else {
      setEditing(false);
      await loadData();
    }
  }

  async function removeMember(userId: string) {
    if (!confirm("Remove this member from the team?")) return;
    const { error } = await supabase.from("team_members").delete().eq("team_id", team!.id).eq("user_id", userId);
    if (error) setError(error.message);
    else await loadData();
  }

  async function leaveTeam() {
    if (!confirm("Leave this team?")) return;
    await supabase.from("team_members").delete().eq("team_id", team!.id).eq("user_id", user!.id);
    router.replace("/teams");
  }

  async function deleteTeam() {
    if (!confirm(`Delete team "${team!.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("teams").delete().eq("id", team!.id);
    if (error) setError(error.message);
    else router.replace("/teams");
  }

  async function cancelInvite(inviteId: string) {
    await supabase.from("invites").delete().eq("id", inviteId);
    await loadData();
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="card">
        {!editing ? (
          <div className="flex items-start gap-4">
            <Avatar url={team.image_url} name={team.name} size={72} />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">{team.name}</h1>
              <p className="text-zinc-400 text-sm mt-1 whitespace-pre-wrap">{team.description || "No description"}</p>
            </div>
            {isCaptain && (
              <button className="btn-secondary text-xs" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={saveEdit} className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Avatar url={editImageUrl} name={editName || "?"} size={64} />
              <ImageUpload bucket="team-images" folder={user.id} onUploaded={setEditImageUrl} label="Change image" />
            </div>
            <div>
              <label className="label">Team name</label>
              <input className="input" required value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary">Save</button>
              <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">
          Members <span className="text-zinc-500 font-normal">({members.length})</span>
        </h2>
        <ul className="divide-y divide-zinc-800">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 py-3">
              <Avatar url={m.profiles?.avatar_url} name={m.profiles?.display_name ?? "?"} size={40} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {m.profiles?.display_name}
                  {m.user_id === team.captain_id && (
                    <span className="ml-2 text-xs bg-amber-950 text-amber-300 px-2 py-0.5 rounded-full">captain</span>
                  )}
                  {m.user_id === user.id && <span className="ml-2 text-xs text-zinc-500">(you)</span>}
                </p>
                <p className="text-xs text-zinc-500 truncate">{m.profiles?.email}</p>
              </div>
              {isCaptain && m.user_id !== team.captain_id && (
                <button className="btn-danger text-xs" onClick={() => removeMember(m.user_id)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isCaptain && (
        <div className="card">
          <h2 className="font-semibold mb-3">Invite members</h2>
          <InviteBox kind="team" teamId={team.id} onSent={loadData} hint="Invitees get an email with a link to join this team." />
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

      <div className="flex gap-3">
        {isMember && !isCaptain && (
          <button className="btn-danger" onClick={leaveTeam}>
            Leave team
          </button>
        )}
        {isCaptain && (
          <button className="btn-danger" onClick={deleteTeam}>
            Delete team
          </button>
        )}
      </div>
    </div>
  );
}
