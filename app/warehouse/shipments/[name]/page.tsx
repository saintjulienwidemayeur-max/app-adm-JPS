import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db, openBooking, cargoOf } from "@/lib/wh-store";
import { saveBooking } from "@/lib/wh-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SP = Promise<Record<string, string | undefined>>;
const sel = "h-9 w-full rounded-md border bg-white px-2 text-sm";
const lnk = "inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-100";
const F = ({ label, children, span }: { label: string; children: ReactNode; span?: string }) => <label className={`grid gap-1 text-xs font-medium text-zinc-600 ${span ?? ""}`}>{label}{children}</label>;
const YN = ({ name, v }: { name: string; v: string }) => <select name={name} defaultValue={v} className={sel}><option>NO</option><option>YES</option></select>;

export default async function Page({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: SP }) {
  const name = decodeURIComponent((await params).name);
  const q = await searchParams;
  const sh = db.shipments.find((x) => x.name === name);
  if (!sh) notFound();
  const b = openBooking(sh), c = cargoOf(name), air = sh.ship === "Air", base = `/warehouse/shipments/${encodeURIComponent(name)}`;
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/warehouse/shipments" className="text-sm text-brand underline">All shipments</Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h1>{name} <span className="text-base font-normal text-zinc-600">· {sh.ship} · Cargo ID {sh.cargoId}{sh.shipped ? ` · shipped ${sh.shipped}` : ""}</span></h1>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/bol`} className={lnk}>Bill of Lading</Link>
          <Link href={`${base}/sli`} className={lnk}>Letter of Instruction</Link>
          <Link href={`${base}/cargo`} className={lnk}>Cargo list</Link>
        </div>
      </div>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}
      <p className="mt-1 text-sm text-zinc-600">{c.rows.length} piece{c.rows.length === 1 ? "" : "s"} loaded on {c.pallets.length} pallet{c.pallets.length === 1 ? "" : "s"} · {c.lbs} lb ({c.kg} kg) · {c.cuft} cuft. Save the booking, then open a document: it prints what is saved here.</p>

      <form action={saveBooking} className="mt-4 grid gap-4">
        <input type="hidden" name="shipment" value={name} />
        <section className="rounded-lg border p-3">
          <h2 className="font-bold">Carrier and dates</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <F label={air ? "Airline" : "Shipping line"}><Input name="line" defaultValue={b.line} /></F>
            <F label={air ? "Flight date" : "Sailing date"}><Input name="sailDate" type="date" defaultValue={b.sailDate} /></F>
            <F label="Origin"><Input name="origin" defaultValue={b.origin} /></F>
            <F label="Destination"><Input name="destination" defaultValue={b.destination} /></F>
            <F label={air ? "Flight / vessel" : "Vessel"}><Input name="vessel" defaultValue={b.vessel} /></F>
            <F label={air ? "Booking AWB" : "Booking number"}><Input name="awb" defaultValue={b.awb} /></F>
            <F label="Bill of lading number"><Input name="bol" defaultValue={b.bol} /></F>
            <F label="Freight payable at"><Input name="freightPayableAt" defaultValue={b.freightPayableAt} /></F>
            <F label="BL cost ($)"><Input name="blCost" type="number" step="0.01" min="0" defaultValue={b.blCost} /></F>
            <F label="Declared value ($)"><Input name="declared" type="number" step="0.01" min="0" defaultValue={b.declared} /></F>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <h2 className="font-bold">Shipper</h2>
            <div className="mt-2 grid gap-2">
              <F label="Name"><Input name="shipperName" defaultValue={b.shipperName} /></F>
              <F label="Address"><Input name="shipperAddress" defaultValue={b.shipperAddress} /></F>
              <F label="City, country"><Input name="shipperCity" defaultValue={b.shipperCity} /></F>
              <F label="Phone / email"><Input name="shipperContact" defaultValue={b.shipperContact} /></F>
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <h2 className="font-bold">Consignee</h2>
            <div className="mt-2 grid gap-2">
              <F label="Name"><Input name="consigneeName" defaultValue={b.consigneeName} /></F>
              <F label="Address"><Input name="consigneeAddress" defaultValue={b.consigneeAddress} /></F>
              <F label="City, country"><Input name="consigneeCity" defaultValue={b.consigneeCity} /></F>
              <F label="Phone / email"><Input name="consigneeContact" defaultValue={b.consigneeContact} /></F>
            </div>
          </div>
          <div className="rounded-lg border p-3 sm:col-span-2">
            <div className="grid gap-2 sm:grid-cols-3">
              <F label="Receiver"><Input name="receiver" defaultValue={b.receiver} /></F>
              <F label="Notify"><Input name="notify" defaultValue={b.notify} /></F>
              <F label="Notify phone / email"><Input name="notifyContact" defaultValue={b.notifyContact} /></F>
            </div>
          </div>
        </section>

        <section className="rounded-lg border p-3">
          <h2 className="font-bold">Cargo</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <F label="Type of pieces"><Input name="pieceType" defaultValue={b.pieceType} /></F>
            <F label="Number of pieces (from the loaded pieces)"><Input value={c.rows.length} readOnly disabled /></F>
            <F label="Commodity" span="sm:col-span-2"><Input name="commodity" defaultValue={b.commodity} /></F>
            <F label="SED required"><YN name="sed" v={b.sed} /></F>
            <F label="Refrigeration required"><YN name="refrigeration" v={b.refrigeration} /></F>
            <F label="Hazardous material"><YN name="hazmat" v={b.hazmat} /></F>
            <F label="Print name (signature on the letter)"><Input name="signer" defaultValue={b.signer} /></F>
          </div>
          <h3 className="mt-4 text-sm font-semibold">Enclosed contents (Letter of Instruction)</h3>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {b.contents.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_8rem] gap-2">
                <Input name={`cl_${i}`} defaultValue={l.label} placeholder="Description" aria-label={`Contents line ${i + 1}`} />
                <Input name={`cv_${i}`} type="number" step="0.01" min="0" defaultValue={l.value} className="text-right" aria-label={`Value of contents line ${i + 1}`} />
              </div>))}
          </div>
        </section>

        <section className="rounded-lg border p-3">
          <h2 className="font-bold">Pallets and containers</h2>
          {c.pallets.length === 0 ? <p className="mt-1 text-sm text-zinc-600">Nothing is loaded yet. Load pieces on Load pallet and the pallets appear here, with their weight.</p> : (
            <table className="mt-2 w-full text-left text-sm">
              <thead><tr>{["Pallet", "Type", "L (in)", "W (in)", "H (in)", "Pieces", "Weight (lb)"].map((h) => <th key={h} className="px-2 py-1 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{c.pallets.map((p, i) => {
                const info = b.pallets[p] ?? { type: "PALLET", l: 0, w: 0, h: 0 }, mine = c.rows.filter((x) => x.l.pallet === p);
                return (
                  <tr key={p} className="border-b border-zinc-100">
                    <td className="px-2 py-1"><input type="hidden" name={`pn_${i}`} value={p} />{p}</td>
                    <td className="px-2 py-1"><Input name={`pt_${i}`} defaultValue={info.type} aria-label={`Type of ${p}`} /></td>
                    {(["l", "w", "h"] as const).map((k) => <td key={k} className="px-2 py-1"><Input name={`p${k}_${i}`} type="number" step="any" min="0" defaultValue={info[k]} className="w-20" aria-label={`${k.toUpperCase()} of ${p}`} /></td>)}
                    <td className="px-2 py-1">{mine.length}</td><td className="px-2 py-1">{Math.round(mine.reduce((a, x) => a + x.p.lbs, 0) * 100) / 100}</td>
                  </tr>);
              })}</tbody>
            </table>
          )}
        </section>

        <section className="rounded-lg border p-3">
          <h2 className="font-bold">Container and notes</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <F label="Container size"><Input name="containerSize" defaultValue={b.containerSize} /></F>
            <F label="Spot date"><Input name="spotDate" type="date" defaultValue={b.spotDate} /></F>
            <F label="Spot time"><Input name="spotTime" type="time" defaultValue={b.spotTime} /></F>
            <F label="Container ID"><Input name="containerId" defaultValue={b.containerId} /></F>
            <F label="Seal #"><Input name="seal" defaultValue={b.seal} /></F>
            <F label="Container tag"><Input name="tag" defaultValue={b.tag} /></F>
            <F label="Actual arrival date"><Input name="arrivalDate" type="date" defaultValue={b.arrivalDate} /></F>
            <div className="sm:col-span-4"><F label="Destination notes"><Input name="notes" defaultValue={b.notes} /></F></div>
          </div>
        </section>
        <Button type="submit" className="w-40">Save booking</Button>
      </form>
    </main>
  );
}
