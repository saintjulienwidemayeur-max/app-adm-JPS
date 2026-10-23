import Link from "next/link";
import { db, total, balance, payStatus, money, wrCode, repLabel, toUSA } from "@/lib/wh-store";
import { sameTracking } from "@/lib/tracking";
import { createWR } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { ReceiptFilters } from "@/components/receipt-filters";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Warehouse receipts · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const PER = 50;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const needle = (q.q ?? "").trim().toLowerCase();
  // A tracking number (or the tail of one) or a piece number finds the receipt that holds the parcel.
  const byParcel = new Set(needle.length >= 6 ? db.items.filter((i) => i.wr && (i.tracking.toLowerCase().includes(needle) || sameTracking(i.tracking, needle))).map((i) => i.wr!) : []);
  const loaded = new Set(db.loads.map((l) => l.no));
  const rows = db.wrs.filter((w) => (!q.ship || w.ship === q.ship)
    && (!needle || w.customer.toLowerCase().includes(needle) || String(w.cust) === needle || wrCode(w).toLowerCase().includes(needle) || byParcel.has(w.id) || w.pieces.some((p) => String(p.no) === needle))
    && (!q.st || (q.st === "waiting" ? w.pieces.some((p) => !loaded.has(p.no)) : q.st === "loaded" ? w.pieces.some((p) => loaded.has(p.no)) : q.st === "unpaid" ? balance(w) > 0 : q.st === "noinvoice" ? !w.invoice : true)));
  const pages = Math.max(1, Math.ceil(rows.length / PER)), page = Math.min(pages, Math.max(1, Number(q.page) || 1));
  const shown = rows.slice((page - 1) * PER, page * PER);
  const link = (n: number) => `/warehouse/receipts?${new URLSearchParams({ ...(q.q && { q: q.q }), ...(q.ship && { ship: q.ship }), ...(q.st && { st: q.st }), page: String(n) })}`;
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Warehouse receipts</h1>
      <p className="text-sm text-zinc-600">JPF receipts ship by air, JPL by boat. Open a receipt to add pieces, fees, credits and payments.</p>
      <form action={createWR} className="mt-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-[1.4fr_6rem_6rem_9rem_1fr_auto]">
        <Input name="customer" list="cust" placeholder="Customer (name or number; new names are added to Customers)" required />
        <Input name="route" placeholder="Route" maxLength={12} aria-label="Route" />
        <select name="ship" aria-label="Ship type" className="h-9 rounded-md border bg-white px-2 text-sm"><option>Air</option><option>Ocean</option></select>
        <select name="dest" aria-label="Going to" className="h-9 rounded-md border bg-white px-2 text-sm"><option value="">To Haiti</option><option value="Miami">To Miami</option></select>
        <Input name="comments" placeholder="Comments" />
        <Button type="submit">New receipt</Button>
        <div className="col-span-full mt-1 grid gap-2 border-t pt-2 sm:grid-cols-[1fr_1.4fr_repeat(4,4.5rem)_4.5rem]">
          <p className="col-span-full text-xs text-zinc-600">Optional: type the first boxes now (same size and weight, Qty of them). Otherwise open the receipt and use &quot;Add piece&quot;.</p>
          <Input name="type" placeholder="Type (BOX - OTHER)" aria-label="Type" />
          <Input name="contents" placeholder="Contents of the box" maxLength={120} aria-label="Contents" />
          {["l", "w", "h", "lbs"].map((k) => <Input key={k} name={k} type="number" step="any" min="0" placeholder={k === "lbs" ? "lb each" : k.toUpperCase()} aria-label={k === "lbs" ? "Weight of each box (lb)" : k} />)}
          <Input name="qty" type="number" step="1" min="1" max="100" defaultValue={1} aria-label="Number of boxes" title="Number of boxes with these measures" />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600 sm:col-span-5"><input type="checkbox" name="newcust" value="yes" /> New customer (tick only if the name is really a new person: a name close to an existing customer is refused, to avoid typos)</label>
        <datalist id="cust">{db.customers.map((c) => <option key={c.no} value={c.name}>{c.no}</option>)}</datalist>
      </form>
      <ReceiptFilters q={q.q ?? ""} ship={q.ship ?? ""} st={q.st ?? ""} />
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {rows.length === 0 ? <p className="mt-6 text-sm text-zinc-600">{db.wrs.length ? "No receipt matches the filter." : "No receipts yet. Create one for a customer above."}</p> : (
        <table className="mt-5 w-full text-left text-sm">
          <thead><tr>{["Receipt", "Date", "Customer", "Ship", "Rep", "Pieces", "Total", "Payment", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{shown.map((w) => (
            <tr key={w.id} className="border-b border-zinc-100">
              <td className={`${td} font-semibold`}>{wrCode(w)}</td><td className={td}>{w.date}</td><td className={td}>{w.customer} <span className="text-xs text-zinc-500">#{w.cust}</span></td><td className={td}>{w.ship}{toUSA(w) && <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-semibold text-sky-800">to Miami</span>}</td>
              <td className={td}>{repLabel(w.rep) || "–"}</td><td className={td}>{w.pieces.length}</td><td className={td}>{money(total(w))}</td><td className={td}>{payStatus(w)}</td>
              <td className={td}><Link href={`/warehouse/receipts/${w.id}`} className="text-brand underline">Open</Link></td>
            </tr>))}</tbody>
        </table>
      )}
      {rows.length > 0 && <p className="mt-2 text-xs text-zinc-600">{rows.length} of {db.wrs.length} receipts</p>}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? <Link href={link(page - 1)} className="py-2 text-brand underline">Previous</Link> : <span className="py-2 text-zinc-400">Previous</span>}
          <span>Page {page} of {pages}</span>
          {page < pages ? <Link href={link(page + 1)} className="py-2 text-brand underline">Next</Link> : <span className="py-2 text-zinc-400">Next</span>}
        </div>
      )}
    </main>
  );
}
