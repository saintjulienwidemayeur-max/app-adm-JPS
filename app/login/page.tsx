import { login } from "@/lib/auth";
import { VERSION } from "@/lib/version";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sign in · JP's Logistics" };

export default async function Page({ searchParams }: { searchParams: Promise<{ err?: string; mins?: string }> }) {
  const q = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="JP's Logistics & More" className="mx-auto h-20 w-auto" />
      <form action={login} className="grid gap-3 rounded-lg border p-4">
        <label className="grid gap-1 text-sm font-medium text-zinc-700">Name
          <Input name="name" autoComplete="username" autoCapitalize="none" autoFocus required />
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-700">Code
          <Input name="code" type="password" inputMode="text" autoComplete="current-password" required />
        </label>
        {q.err === "db" ? <p role="alert" className="text-sm font-medium text-red-700">The database is not reachable, so nobody can sign in right now. The administrator must check DATABASE_URL (the Supabase &quot;Transaction pooler&quot; address with the database password). The server log says why: &quot;[persist] cannot load the database&quot;.</p>
          : q.err === "locked" ? <p role="alert" className="text-sm font-medium text-red-700">Too many wrong codes. Try again in {q.mins ?? "10"} minute(s).</p>
          : q.err && <p role="alert" className="text-sm font-medium text-red-700">Wrong name or code.</p>}
        <Button type="submit">Sign in</Button>
      </form>
      <p className="text-center text-xs text-zinc-400">Version {VERSION}</p>
    </main>
  );
}
