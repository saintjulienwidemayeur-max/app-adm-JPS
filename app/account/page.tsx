import { requireUser } from "@/lib/users";
import { changeOwnCode } from "@/lib/user-actions";
import { MIN_CODE } from "@/lib/users";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "My account · JP's Logistics" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const me = await requireUser(), q = await searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1>My account</h1>
      <p className="text-sm text-zinc-600">Signed in as <b>{me.name}</b>{me.admin ? " (administrator)" : ""}. Change your code whenever you want.</p>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}
      <form action={changeOwnCode} className="mt-4 grid gap-3 rounded-lg border p-4">
        <label className="grid gap-1 text-xs font-medium text-zinc-600">Current code<Input name="current" type="password" autoComplete="current-password" required /></label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">New code (at least {MIN_CODE} characters)<Input name="next" type="password" autoComplete="new-password" required /></label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">New code again<Input name="again" type="password" autoComplete="new-password" required /></label>
        <Button type="submit">Change my code</Button>
      </form>
    </main>
  );
}
