"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) { setError("Wrong email or password."); setBusy(false); return; }
    router.push("/warehouse/intake");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">JP&apos;s Logistics &amp; More</h1>
        <div className="space-y-1"><Label>Email</Label><Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1"><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <Button type="submit" disabled={busy} className="h-11 w-full">{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </main>
  );
}
