import { login } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sign in · JP's Logistics" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; err?: string }> }) {
  const q = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="JP's Logistics & More" className="mx-auto h-20 w-auto" />
      <form action={login} className="grid gap-3 rounded-lg border p-4">
        <input type="hidden" name="next" value={q.next ?? ""} />
        <label className="grid gap-1 text-sm font-medium text-zinc-700">Password
          <Input name="password" type="password" autoComplete="current-password" autoFocus required />
        </label>
        {q.err && <p role="alert" className="text-sm font-medium text-red-700">Wrong password.</p>}
        <Button type="submit">Sign in</Button>
      </form>
    </main>
  );
}
