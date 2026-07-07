"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/lib/useUser";
import { unitToKg } from "@/lib/weight";
import { todayStr } from "@/lib/competition";
import type { WeightUnit } from "@/lib/types";
import Avatar from "@/components/Avatar";
import ImageUpload from "@/components/ImageUpload";

export default function OnboardingPage() {
  const { user, profile, loading, refresh } = useRequireUser();
  const router = useRouter();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (profile && !initialized) {
      setName(profile.display_name);
      setUnit(profile.weight_unit);
      setAvatarUrl(profile.avatar_url);
      setInitialized(true);
    }
  }, [profile, initialized]);

  if (loading || !user) return <p className="text-zinc-500">Loading…</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    const weightKg = unitToKg(parseFloat(currentWeight), unit);
    const targetKg = targetWeight ? unitToKg(parseFloat(targetWeight), unit) : null;

    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim(),
        weight_unit: unit,
        avatar_url: avatarUrl,
        target_weight_kg: targetKg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (pErr) {
      setError(pErr.message);
      setBusy(false);
      return;
    }
    const { error: wErr } = await supabase
      .from("weigh_ins")
      .upsert({ user_id: user.id, weight_kg: weightKg, measured_on: todayStr() }, { onConflict: "user_id,measured_on" });
    if (wErr) {
      setError(wErr.message);
      setBusy(false);
      return;
    }
    await refresh();
    const n = new URLSearchParams(window.location.search).get("next");
    router.replace(n && n.startsWith("/") ? n : "/dashboard");
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-2">Set up your profile</h1>
      <p className="text-zinc-400 text-sm mb-6">Tell us who you are and where you&apos;re starting from.</p>
      <form onSubmit={save} className="card flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar url={avatarUrl} name={name || "?"} size={64} />
          <ImageUpload bucket="avatars" folder={user.id} onUploaded={setAvatarUrl} label="Upload profile image" />
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Current weight ({unit})</label>
            <input
              className="input"
              type="number"
              step="0.1"
              min="1"
              required
              value={currentWeight}
              onChange={(e) => setCurrentWeight(e.target.value)}
            />
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
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </div>
  );
}
