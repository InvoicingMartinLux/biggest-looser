"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ImageUpload({
  bucket,
  folder,
  onUploaded,
  label = "Upload image",
}: {
  bucket: "avatars" | "team-images";
  folder: string;
  onUploaded: (publicUrl: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
      setError(error.message);
    } else {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onUploaded(data.publicUrl);
    }
    setBusy(false);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="text-sm px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "Uploading…" : label}
      </button>
      {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
    </div>
  );
}
