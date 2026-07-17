"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError("That didn't work — check the email and password.");
      setBusy(false);
      return;
    }
    router.push("/parent");
    router.refresh();
  };

  return (
    <form onSubmit={signIn} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-warm-gray block mb-1.5">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="w-full bg-cream rounded-xl px-4 py-3 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50 transition-colors"
        />
      </div>
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-warm-gray block mb-1.5">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full bg-cream rounded-xl px-4 py-3 text-sm text-espresso outline-none border border-sand-dark/50 focus:border-rust/50 transition-colors"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 bg-rust text-white rounded-full text-sm font-medium shadow-md hover:bg-rust/90 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
