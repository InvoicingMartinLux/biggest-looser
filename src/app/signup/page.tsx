"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [next, setNext] = useState("/onboarding");
  const router = useRouter();

  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("next");
    if (n && n.startsWith("/")) setNext(n);
  }, []);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}${next}` },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    if (data.session) {
      router.replace(next === "/onboarding" ? next : `/onboarding?next=${encodeURIComponent(next)}`);
    } else {
      // email confirmation is enabled in Supabase — user must click the link first
      setNeedsConfirm(true);
      setBusy(false);
    }
  }

  if (needsConfirm) {
    return (
      <div className="max-w-sm mx-auto mt-12 card text-center">
        <div className="text-4xl mb-3">📬</div>
        <h1 className="text-xl font-bold mb-2">Check your email</h1>
        <p className="text-sm text-zinc-400">
          We sent a confirmation link to <span className="text-zinc-200">{email}</span>. Click it to activate your
          account, then sign in.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="text-2xl font-bold mb-6 text-center">Create your account</h1>
      <form onSubmit={signUp} className="card flex flex-col gap-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating account…" : "Sign up"}
        </button>
        <div className="flex items-center gap-3 text-zinc-600 text-xs">
          <div className="h-px bg-zinc-800 flex-1" /> or <div className="h-px bg-zinc-800 flex-1" />
        </div>
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() =>
            supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: `${window.location.origin}${next}` },
            })
          }
        >
          Continue with Google
        </button>
        <p className="text-sm text-zinc-400 text-center">
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-emerald-400 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
