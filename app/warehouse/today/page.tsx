import Link from "next/link";
import { db, findPiece, wrCode, r2 } from "@/lib/wh-store";
import { isoToday, isoToUs } from "@/lib/clock";
import { PrintButton } from "@/components/print-button";
import { AutoForm } from "@/components/auto-form";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Day summary · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1";

// What the warehouse did on one day (parcels scanned, pieces loaded, shipped, received in Haiti, receipts opened) and what is still waiting. Printable.
export default async function Page({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(q.d ?? "") ? q.d! : isoToday(), us = isoToUs(iso);
  const by = new Map<string, { scanned: number; loaded: number; here: number; receipts: number }>();
  const who = (n: string) => { const k = n || "–"; let e = by.get(k); if (!e) by.set(k, (e = { scanned: 0, loaded: 0, here: 0, receipts: 0 })); return e; };
  const items = db.items.filter((i) => i.date === us);
  items.forEach((i) => who(i.by ?? "").scanned++);
  const loads = db.loads.filter((l) => l.date === us);
  loads.forEach((l) => who(l.by ?? "").loaded++);
  const here = db.loads.filter((l) => l.here === us);
  here.forEach((l) => who(l.hereBy ?? "").here++);
  const wrs = db.wrs.filter((w) => w.date === us);
  wrs.forEach((w) => who(w.by ?? "").receipts++);
  const carriers = new Map<string, number>();
  items.forEach((i) => carriers.set(i.carrier, (carriers.get(i.carrier) ?? 0) + 1));
  const shipped = db.shipments.filter((s) => s.shipped === us);
  const loadedNos = new Set(db.loads.map((l) => l.no));
  const waitingParcels = db.items.filter((i) => !i.piece), unknown = waitingParcels.filter((i) => !i.customer);
  const waitingPieces = db.wrs.flatMap((w) => w.pieces.filter((p) => !loadedNos.has(p.no)).map((p) => ({ w, p })));
  const onTheWay = db.loads.filter((l) => !l.here && db.shipments.find((s) => s.name === l.shipment)?.shipped);
  const oldest = waitingParcels.length ? waitingParcels.map((i) => i.date).sort((a, b) => Date.parse(a) - Date.parse(b))[0] : "";
  const lbsOf = (nos: number[]) => r2(nos.reduce((a, n) => a + (findPiece(n)?.p.lbs ?? 0), 0));
  const card = "rounded-lg border p-3";
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1>Day summary · {us}</h1><PrintButton /></div>
      <AutoForm className="no-print mt-3 flex items-center gap-2"><Input name="d" type="date" defaultValue={iso} className="w-44" aria-label="Day" /><span className="text-xs text-zinc-600">Pick a day: it shows by itself.</span></AutoForm>

      <section className="mt-4 grid gap-3 sm:grid-cols-4">
        {[["Parcels scanned", items.length], ["Pieces loaded", loads.length], ["Received in Haiti", here.length], ["Receipts opened", wrs.length]].map(([l, n]) => <div key={l} className={card}><div className="text-3xl font-extrabold text-brand">{n}</div><div className="text-xs text-zinc-600">{l}</div></div>)}
      </section>

      <h2 className="mt-6 font-bold">Who did what</h2>
      {by.size === 0 ? <p className="mt-1 text-sm text-zinc-600">Nothing was recorded on {us}.</p> : (
        <table className="mt-1 w-full text-left text-sm">
          <thead><tr>{["Person", "Parcels scanned", "Receipts opened", "Pieces loaded", "Pieces received in Haiti"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{[...by].sort((a, b) => a[0].localeCompare(b[0])).map(([n, e]) => <tr key={n} className="border-b border-zinc-100"><td className={td}>{n}</td><td className={td}>{e.scanned}</td><td className={td}>{e.receipts}</td><td className={td}>{e.loaded}</td><td className={td}>{e.here}</td></tr>)}</tbody>
        </table>
      )}
      {carriers.size > 0 && <p className="mt-2 text-sm text-zinc-700">Parcels by carrier: {[...carriers].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(" · ")}. Not identified yet: {items.filter((i) => !i.customer).length}.</p>}
      {shipped.length > 0 && <p className="mt-2 text-sm text-zinc-700">Shipped: {shipped.map((s) => <span key={s.name}><Link href={`/warehouse/shipments/${encodeURIComponent(s.name)}`} className="font-semibold text-brand underline">{s.name}</Link> ({db.loads.filter((l) => l.shipment === s.name).length} pieces, {lbsOf(db.loads.filter((l) => l.shipment === s.name).map((l) => l.no))} lb) </span>)}</p>}

      <h2 className="mt-6 font-bold">Still waiting (right now)</h2>
      <ul className="mt-1 grid gap-1 text-sm">
        <li><b>{waitingParcels.length}</b> parcel{waitingParcels.length === 1 ? "" : "s"} received and not consolidated{oldest ? ` (oldest ${oldest})` : ""}, <b>{unknown.length}</b> with no customer yet: <Link href="/warehouse/consolidate" className="text-brand underline">Consolidate</Link></li>
        <li><b>{waitingPieces.length}</b> piece{waitingPieces.length === 1 ? "" : "s"} in the warehouse not loaded yet ({lbsOf(waitingPieces.map((x) => x.p.no))} lb): <Link href="/warehouse/loading-sheet" className="text-brand underline">Loading sheet</Link></li>
        <li><b>{onTheWay.length}</b> piece{onTheWay.length === 1 ? "" : "s"} shipped and not received in Haiti yet: <Link href="/warehouse/arrivals" className="text-brand underline">Arrivals PV</Link></li>
        <li><b>{db.wrs.filter((w) => w.pieces.length && w.pieces.every((p) => db.loads.some((l) => l.no === p.no && l.here)) && !w.ready).length}</b> receipt(s) fully received in Haiti, not marked ready for pickup</li>
      </ul>

      {wrs.length > 0 && (<>
        <h2 className="mt-6 font-bold">Receipts opened on {us}</h2>
        <table className="mt-1 w-full text-left text-sm">
          <thead><tr>{["Receipt", "Customer", "Pieces", "By"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{wrs.slice(0, 200).map((w) => <tr key={w.id} className="border-b border-zinc-100"><td className={td}><Link href={`/warehouse/receipts/${w.id}`} className="text-brand underline">{wrCode(w)}</Link></td><td className={td}>{w.customer}</td><td className={td}>{w.pieces.length}</td><td className={td}>{w.by || "–"}</td></tr>)}</tbody>
        </table>
      </>)}
    </main>
  );
}
