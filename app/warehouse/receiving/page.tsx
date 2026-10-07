import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "@/lib/wh-store";
import { isoToUs, isoToday } from "@/lib/clock";
import { receiveItem, startDelivery, endDelivery, updateItem, deleteItem } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CameraScan } from "@/components/camera-scan";

export const metadata = { title: "Received items · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const PER = 50;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const jar = await cookies();
  let sess: { batch: string; date: string; carrier: string; receiver: string } | null = null;
  try { sess = JSON.parse(jar.get("rcv")?.value ?? "null"); } catch { sess = null; }
  const carriers = [...new Set([...db.carriers, ...db.items.map((i) => i.carrier)])].sort();
  const count = sess ? db.items.filter((i) => i.batch === sess.batch).length : 0;

  const date = q.date ? isoToUs(q.date) : "";
  const needle = (q.find ?? "").toLowerCase();
  const all = [...db.items].reverse().filter((i) =>
    (!needle || i.tracking.toLowerCase().includes(needle) || (i.customer ?? "").toLowerCase().includes(needle) || i.receiver.toLowerCase().includes(needle)) &&
    (!q.fcarrier || i.carrier === q.fcarrier) && (!date || i.date === date) && (q.show !== "open" || !i.piece));
  const pages = Math.max(1, Math.ceil(all.length / PER));
  const page = Math.min(pages, Math.max(1, Number(q.page) || 1));
  const rows = all.slice((page - 1) * PER, page * PER);
  const link = (p: number) => `/warehouse/receiving?${new URLSearchParams({ ...(q.find && { find: q.find }), ...(q.fcarrier && { fcarrier: q.fcarrier }), ...(q.date && { date: q.date }), ...(q.show && { show: q.show }), page: String(p) })}`;
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Received items</h1>
      <p className="text-sm text-zinc-600">One delivery at a time: set the date and carrier once, then scan each parcel. The customer is added later, when you consolidate.</p>

      {!sess ? (
        <form action={startDelivery} className="mt-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-[10rem_1fr_1fr_auto]">
          <Input name="date" type="date" defaultValue={isoToday()} aria-label="Date received" required />
          <Input name="carrier" list="carriers" placeholder="Carrier: pick one or type a new one (it is saved)" required />
          <Input name="receiver" placeholder="Received by (optional)" defaultValue={jar.get("rcv_name")?.value} />
          <Button type="submit">Start scanning</Button>
          <datalist id="carriers">{carriers.map((c) => <option key={c} value={c} />)}</datalist>
        </form>
      ) : (
        <section className="mt-4 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-zinc-700"><b>{sess.carrier}</b> · {sess.date} · {sess.receiver && <>received by <b>{sess.receiver}</b></>}</div>
            <form action={endDelivery}><Button type="submit" variant="outline">Finish delivery</Button></form>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div className="text-center"><div className="text-4xl font-extrabold leading-none text-brand" aria-live="polite">{count}</div><div className="text-xs text-zinc-600">parcel{count === 1 ? "" : "s"} accepted</div></div>
            <form action={receiveItem} className="flex min-w-60 flex-1 gap-1">
              <Input id="tracking" name="tracking" placeholder="Scan tracking number" autoFocus autoComplete="off" required />
              <CameraScan target="tracking" submit />
              <Button type="submit">Add</Button>
            </form>
          </div>
          {q.err && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{q.err}</p>}
          {q.ok && <p className="mt-2 font-mono text-xs text-green-700">{q.ok} accepted</p>}
        </section>
      )}
      {!sess && q.err && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{q.err}</p>}
      {!sess && q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}

      <form className="mt-5 flex flex-wrap items-center gap-2">
        <Input name="find" placeholder="Search tracking, customer, receiver" defaultValue={q.find} className="max-w-64" />
        <select name="fcarrier" defaultValue={q.fcarrier ?? ""} className="h-9 rounded-md border bg-white px-2 text-sm"><option value="">All carriers</option>{carriers.map((c) => <option key={c}>{c}</option>)}</select>
        <Input name="date" type="date" defaultValue={q.date} className="w-40" aria-label="Date" />
        <select name="show" defaultValue={q.show ?? ""} className="h-9 rounded-md border bg-white px-2 text-sm"><option value="">All parcels</option><option value="open">Not consolidated yet</option></select>
        <Button type="submit" variant="outline">Filter</Button>
        <Link href="/warehouse/receiving" className="text-sm text-brand underline">Clear</Link>
      </form>
      <p className="mb-2 mt-3 text-sm text-zinc-600">{all.length} of {db.items.length} parcels · {db.items.filter((i) => !i.piece).length} waiting to be consolidated</p>
      {rows.length === 0 ? <p className="text-sm text-zinc-600">No parcels match. Clear the filters or start scanning.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr>{["Date", "Received by", "Carrier", "Tracking", "Customer", "JP's piece", "Shipped", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((i) => (
            <tr key={i.id} className="border-b border-zinc-100">
              <td className={td}>{i.date}</td><td className={td}>{i.receiver || "–"}</td><td className={td}>{i.carrier}</td>
              <td className={`${td} font-mono text-xs`}>{i.tracking}</td>
              <td className={td}>{i.customer ?? <span className="text-zinc-400">–</span>}{i.customer && !i.clientId && <span className="ml-1 text-xs text-amber-700">· not on website</span>}</td>
              <td className={td}>{i.piece ?? <span className="text-zinc-400">–</span>}</td><td className={td}>{i.shipped ? "Yes" : "No"}</td>
              <td className={td}><details><summary className="cursor-pointer text-brand underline">Edit</summary>
                <form action={updateItem} className="mt-1 grid gap-1"><input type="hidden" name="id" value={i.id} />
                  <Input name="tracking" defaultValue={i.tracking} aria-label="Tracking" /><Input name="carrier" defaultValue={i.carrier} aria-label="Carrier" />
                  <Button type="submit">Save</Button></form>
                {!i.piece && <form action={deleteItem} className="mt-1"><input type="hidden" name="id" value={i.id} /><button className="text-red-700 underline">Delete parcel</button></form>}
              </details></td>
            </tr>))}</tbody>
        </table></div>
      )}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? <Link href={link(page - 1)} className="text-brand underline">Previous</Link> : <span className="text-zinc-400">Previous</span>}
          <span>Page {page} of {pages}</span>
          {page < pages ? <Link href={link(page + 1)} className="text-brand underline">Next</Link> : <span className="text-zinc-400">Next</span>}
        </div>
      )}
    </main>
  );
}
