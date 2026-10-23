import Link from "next/link";
import { db, type Item } from "@/lib/wh-store";
import { singlePiece, combinePieces, scanForConsolidate } from "@/lib/wh-actions";
import { CameraScan } from "@/components/camera-scan";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Consolidate · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";
const PER = 100;

function Fields({ focus, item }: { focus?: boolean; item?: Item }) {
  return (
    <>
      <Input name="customer" list="cust" placeholder="Customer (name, number 1001, box JPS-1234 or e-mail)" defaultValue={item?.customer} className="min-w-56 flex-1" autoFocus={focus} required />
      <select name="ship" aria-label="Ship type" defaultValue={item?.ship ?? "Air"} className="h-9 rounded-md border bg-white px-2 text-sm"><option>Air</option><option>Ocean</option></select>
      <Input name="type" placeholder="Type (BOX - OTHER)" className="w-40" />
      <Input name="contents" placeholder="Contents of this piece (required)" maxLength={120} className="min-w-56 flex-1" required />
      {["l", "w", "h", "lbs"].map((k) => <Input key={k} name={k} type="number" step="any" min="0" placeholder={k === "lbs" ? "lb" : k.toUpperCase()} aria-label={k} className="w-16" required />)}
      <label className="flex w-full items-center gap-1.5 text-xs text-zinc-600"><input type="checkbox" name="newcust" value="yes" /> New customer (tick only if this name is really a new person: a name close to an existing customer is refused, to avoid typos)</label>
      <div className="flex w-full flex-wrap gap-x-5 gap-y-1 text-sm">
        <label className="flex items-center gap-1.5"><input type="radio" name="receipt" value="open" defaultChecked /> Add to the customer&apos;s open receipt for the next shipment (a new one is opened if there is none)</label>
        <label className="flex items-center gap-1.5"><input type="radio" name="receipt" value="new" /> Always a new warehouse receipt (JPF by air, JPL by boat)</label>
      </div>
    </>
  );
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const picks = (q.pick ?? "").split(",").filter(Boolean);
  const waiting = db.items.filter((i) => !i.piece);
  // Filter by tracking, customer or carrier; a parcel that is selected always stays on the list.
  const needle = (q.find ?? "").trim().toLowerCase(), who = q.who ?? "";
  const open = waiting.filter((i) => picks.includes(String(i.id)) || ((!needle || i.tracking.toLowerCase().includes(needle) || (i.customer ?? "").toLowerCase().includes(needle) || i.carrier.toLowerCase().includes(needle)) && (!who || (who === "none" ? !i.customer : !!i.customer))));
  const pages = Math.max(1, Math.ceil(open.length / PER)), page = Math.min(pages, Math.max(1, Number(q.page) || 1));
  const onPage = open.slice((page - 1) * PER, page * PER);
  const shown = [...open.filter((i) => picks.includes(String(i.id)) && !onPage.includes(i)), ...onPage];
  const link = (n: number) => `/warehouse/consolidate?${new URLSearchParams({ ...(q.find && { find: q.find }), ...(who && { who }), ...(picks.length && { pick: picks.join(",") }), page: String(n) })}`;
  const first = open.find((i) => picks.includes(String(i.id)));
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Consolidate</h1>
      <p className="text-sm text-zinc-600">A parcel that ships alone gets its own JP&apos;s piece number and label. Several parcels for the same customer share one new piece. Each piece is added at once to the customer&apos;s open warehouse receipt (Air and Ocean have separate receipts) for the next shipment, or opens a new one. A parcel the customer announced already shows the customer and the shipping choice.</p>
      {q.err && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{q.err}</p>}
      {q.ok && (
        <p className="mt-2 text-sm font-medium text-green-700">{q.ok}{" "}
          {q.wr && <Link href={`/warehouse/receipts/${q.wr}/labels${q.piece ? `?only=${q.piece}` : ""}`} className="text-brand underline">Print the label</Link>}
        </p>
      )}
      {q.warn && <p role="alert" className="mt-1 text-sm font-medium text-amber-700">{q.warn}</p>}
      <form action={scanForConsolidate} className="mt-4 flex gap-1 rounded-lg border p-3">
        <input type="hidden" name="picks" value={picks.join(",")} />
        <Input id="ctrack" name="tracking" placeholder="Scan a parcel here: it is selected, and received first if it is not in the system yet" autoFocus={!first} autoComplete="off" required />
        <CameraScan target="ctrack" submit />
        <Button type="submit">Scan</Button>
      </form>
      <datalist id="cust">{db.customers.map((c) => <option key={c.no} value={c.name}>{c.no}</option>)}</datalist>

      <h2 className="mt-5 font-bold">Parcels waiting to be consolidated ({waiting.length})</h2>
      {waiting.length > 0 && (
        <form className="mt-2 flex flex-wrap items-center gap-2">
          {picks.length > 0 && <input type="hidden" name="pick" value={picks.join(",")} />}
          <Input name="find" defaultValue={q.find} placeholder="Find by tracking, customer or carrier" className="max-w-64" aria-label="Find a waiting parcel" />
          <select name="who" defaultValue={who} className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="Customer known"><option value="">All parcels</option><option value="none">Unidentified only</option><option value="known">Announced / identified only</option></select>
          <Button type="submit" variant="outline">Filter</Button>
          <Link href="/warehouse/consolidate" className="text-sm text-brand underline">Clear</Link>
          {open.length !== waiting.length && <span className="text-xs text-zinc-600">{open.length} match</span>}
        </form>
      )}
      {waiting.length === 0 ? <p className="mt-1 text-sm text-zinc-600">Nothing waiting. Scan a parcel above, or on Received items.</p> : open.length === 0 ? <p className="mt-2 text-sm text-zinc-600">No waiting parcel matches. Clear the filter.</p> : (
        <>
          <table className="mt-2 w-full text-left text-sm">
            <thead><tr>{["", "Date", "Carrier", "Tracking", "Announced for", "Ships alone"].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            <tbody>{shown.map((i) => (
              <tr key={i.id} className={`border-b border-zinc-100 align-top ${picks.includes(String(i.id)) ? "bg-amber-50" : ""}`}>
                <td className={td}><input type="checkbox" form="combine" name="id" value={i.id} defaultChecked={picks.includes(String(i.id))} aria-label={`Select ${i.tracking}`} /></td>
                <td className={td}>{i.date}</td><td className={td}>{i.carrier}</td><td className={`${td} font-mono text-xs`}>{i.tracking}</td>
                <td className={td}>{i.customer ? <>{i.customer} · {i.ship}</> : <span className="text-amber-700">Unidentified</span>}</td>
                <td className={td}><details open={first?.id === i.id}><summary className="cursor-pointer text-brand underline">Make its own piece</summary>
                  <form action={singlePiece} className="mt-1 flex max-w-xl flex-wrap gap-1"><input type="hidden" name="id" value={i.id} /><Fields focus={first?.id === i.id} item={i} /><Button type="submit">Create piece</Button></form>
                </details></td>
              </tr>))}</tbody>
          </table>
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-4 text-sm">
              {page > 1 ? <Link href={link(page - 1)} className="text-brand underline">Previous</Link> : <span className="text-zinc-400">Previous</span>}
              <span>Page {page} of {pages} · select the parcels of one piece on the same page</span>
              {page < pages ? <Link href={link(page + 1)} className="text-brand underline">Next</Link> : <span className="text-zinc-400">Next</span>}
            </div>
          )}
          <form id="combine" action={combinePieces} className="mt-4 rounded-lg border p-3">
            <h3 className="mb-2 text-sm font-semibold">Combine the selected parcels into one piece</h3>
            <div className="flex flex-wrap gap-1"><Fields item={first} /><Button type="submit">Combine into one piece</Button></div>
          </form>
        </>
      )}
    </main>
  );
}
