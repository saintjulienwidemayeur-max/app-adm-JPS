import { db, money, DESTINATIONS, destLabel, AIR_RATE, OCEAN_RATE } from "@/lib/wh-store";
import { requireAdmin } from "@/lib/users";
import { saveFeeSettings, saveRates } from "@/lib/settings-actions";
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
      {q.err && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p role="status" className="mt-3 text-sm font-medium text-green-700">{q.ok}</p>}
      <h2 className="mt-5 font-bold">Rates by destination</h2>
      <p className="text-sm text-zinc-600">Each parcel goes to one destination, and each destination has its own rates: Air is billed per lb, Ocean per cubic foot. A new receipt takes the rate of its customer&apos;s destination (the consignee city); change the destination on the receipt if the parcel goes elsewhere. A rate typed on one customer&apos;s page stays stronger than these.</p>
      <form action={saveRates} className="mt-2 rounded-lg border bg-white p-4">
        <table className="w-full text-left text-sm"><thead><tr><th className="px-2 py-1 font-semibold">Destination</th><th className="px-2 py-1 text-right font-semibold">Air ($ per lb)</th><th className="px-2 py-1 text-right font-semibold">Ocean ($ per cubic foot)</th></tr></thead>
          <tbody>{DESTINATIONS.map((d, i) => (
            <tr key={d} className="border-t border-zinc-100"><td className="px-2 py-1">{destLabel(d)}</td>
              <td className="px-2 py-1"><Input name={`air_${i}`} type="number" step="0.01" min="0.01" required defaultValue={(s.rates?.[d]?.air ?? AIR_RATE).toFixed(2)} className="ml-auto w-28 text-right" aria-label={`${d} Air rate`} /></td>
              <td className="px-2 py-1"><Input name={`ocean_${i}`} type="number" step="0.01" min="0.01" required defaultValue={(s.rates?.[d]?.ocean ?? OCEAN_RATE).toFixed(2)} className="ml-auto w-28 text-right" aria-label={`${d} Ocean rate`} /></td></tr>))}</tbody></table>
        <div className="mt-3"><Button type="submit">Save the rates</Button></div>
      </form>
      <h2 className="mt-6 font-bold">Storage fee</h2>
      <p className="text-sm text-zinc-600">The terms on every receipt say a storage fee applies after 30 days in the warehouse. The app adds it by itself, as a &quot;Storage fee&quot; line on the receipts whose pieces are still in Miami and that are not invoiced yet. It grows as the days pass and stops when the pieces ship.</p>
      <form action={saveFeeSettings} className="mt-4 grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-zinc-600">Free days in the warehouse<Input name="storageFreeDays" type="number" min="0" max="365" step="1" defaultValue={s.storageFreeDays} className="text-right" /></label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">Storage fee for each 30 days after that ($ per receipt)<Input name="storageFee" type="number" min="0" step="0.01" defaultValue={s.storageFee} className="text-right" /></label>
        <p className="text-xs text-zinc-600 sm:col-span-2">Today: {s.storageFee > 0 ? <>after <b>{s.storageFreeDays} days</b>, <b>{money(s.storageFee)}</b> per receipt for each 30 days (day {s.storageFreeDays + 1}: {money(s.storageFee)}, day {s.storageFreeDays + 31}: {money(s.storageFee * 2)}...)</> : <b>automatic storage fee is off</b>}. {n} receipt{n === 1 ? " has" : "s have"} one now. Receipts that are invoiced, estimates, or already shipped are not changed.</p>
        <div className="sm:col-span-2"><Button type="submit">Save</Button></div>
      </form>
    </main>
  );
}
