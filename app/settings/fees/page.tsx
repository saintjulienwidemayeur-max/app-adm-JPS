import { db, money } from "@/lib/wh-store";
import { requireAdmin } from "@/lib/users";
import { saveFeeSettings } from "@/lib/settings-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Fees & rates · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const q = await searchParams, s = db.settings;
  const n = db.wrs.filter((w) => w.fees.some((f) => f.auto === "storage")).length;
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1>Fees &amp; rates</h1>
      <p className="text-sm text-zinc-600">The terms on every receipt say a storage fee applies after 30 days in the warehouse. The app adds it by itself, as a &quot;Storage fee&quot; line on the receipts whose pieces are still in Miami and that are not invoiced yet. It grows as the days pass and stops when the pieces ship.</p>
      {q.err && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p role="status" className="mt-3 text-sm font-medium text-green-700">{q.ok}</p>}
      <form action={saveFeeSettings} className="mt-4 grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-zinc-600">Free days in the warehouse<Input name="storageFreeDays" type="number" min="0" max="365" step="1" defaultValue={s.storageFreeDays} className="text-right" /></label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">Storage fee for each 30 days after that ($ per receipt)<Input name="storageFee" type="number" min="0" step="0.01" defaultValue={s.storageFee} className="text-right" /></label>
        <p className="text-xs text-zinc-600 sm:col-span-2">Today: {s.storageFee > 0 ? <>after <b>{s.storageFreeDays} days</b>, <b>{money(s.storageFee)}</b> per receipt for each 30 days (day {s.storageFreeDays + 1}: {money(s.storageFee)}, day {s.storageFreeDays + 31}: {money(s.storageFee * 2)}...)</> : <b>automatic storage fee is off</b>}. {n} receipt{n === 1 ? " has" : "s have"} one now. Receipts that are invoiced, estimates, or already shipped are not changed.</p>
        <div className="sm:col-span-2"><Button type="submit">Save</Button></div>
      </form>
    </main>
  );
}
