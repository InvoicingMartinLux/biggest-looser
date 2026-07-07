"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/lib/useUser";
import { unitToKg, kgToUnit } from "@/lib/weight";
import type { WeightUnit } from "@/lib/types";
import Avatar from "@/components/Avatar";
import ImageUpload from "@/components/ImageUpload";

export default function ProfilePage() {
  const { user, profile, loading, refresh } = useRequireUser();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [targetWeight, setTargetWeight] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (profile && !initialized) {
      setName(profile.display_name);
      setUnit(profile.weight_unit);
      setAvatarUrl(profile.avatar_url);
      setTargetWeight(
        profile.target_weight_kg != null ? kgToUnit(profile.target_weight_kg, profile.weight_unit).toFixed(1) : ""
      );
      setInitialized(true);
    }
  }, [profile, initialized]);

  if (loading || !user) return <p className="text-zinc-500">Loading…</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const targetKg = targetWeight ? unitToKg(parseFloat(targetWeight), unit) : null;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim(),
        weight_unit: unit,
        avatar_url: avatarUrl,
        target_weight_kg: targetKg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (error) setError(error.message);
    else {
      setMessage("Profile saved.");
      await refresh();
    }
    setBusy(false);
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Your profile</h1>
      <form onSubmit={save} className="card flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar url={avatarUrl} name={name || "?"} size={64} />
          <ImageUpload bucket="avatars" folder={user.id} onUploaded={setAvatarUrl} label="Change profile image" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input opacity-60" value={user.email ?? ""} disabled />
        </div>
        <div>
          <label className="label">Your name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Preferred unit</label>
          <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as WeightUnit)}>
            <option value="kg">Kilograms (kg)</option>
            <option value="lbs">Pounds (lbs)</option>
          </select>
        </div>
        <div>
          <label className="label">Target weight ({unit})</label>
          <input
            className="input"
            type="number"
            step="0.1"
            min="1"
            value={targetWeight}
            onChange={(e) => setTargetWeight(e.target.value)}
          />
          <p className="text-xs text-zinc-500 mt-1">Your current weight is tracked via weigh-ins on the dashboard.</p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
