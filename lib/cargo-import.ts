// Brings the cargo history of the old system into the app, for reference, from 5 CSV files made for this import:
// old_receipts, old_receipt_pieces, old_scans, old_shipments, old_shipment_pieces. Importing again replaces the old cargo history.
import { type OldWR, type OldShip, r2 } from "./wh-store";
import { parseCsv } from "./csv";

type Table = Record<string, string>[];
function table(text: string, need: string[], name: string): { rows: Table; error?: string } {
  const raw = parseCsv(text);
  if (raw.length < 2) return { rows: [], error: `${name}: the file is empty.` };
  const head = raw[0].map((h) => h.trim().toLowerCase());
  if (head.includes("inv_no") || head.includes("payment_id")) return { rows: [], error: `${name}: this is a file of old invoices or payments: it goes in the billing app. Here: the 5 cargo files.` };
  if (head.includes("customer_no") && head.includes("name") && !head.includes("wr")) return { rows: [], error: `${name}: this looks like the customers file (part 1 above).` };
  for (const n of need) if (!head.includes(n)) return { rows: [], error: `${name}: the column "${n}" is missing. Use the file made for this import.` };
  return { rows: raw.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()]))) };
}
const num = (s: string | undefined) => { const n = Number(s); return Number.isFinite(n) ? n : 0; };
const yes = (s: string | undefined) => s === "yes";

export type CargoResult = { receipts: number; pieces: number; scans: number; ships: number; shipPieces: number; orphanPieces: number; orphanScans: number; problems: string[] };
export function readCargo(f: { receipts: string; pieces: string; scans: string; ships: string; shipPieces: string }): { wrs: OldWR[]; ships: OldShip[]; result: CargoResult; error?: string } {
  const rc = table(f.receipts, ["wr", "date", "customer_no"], "Receipts"), pc = table(f.pieces, ["item", "wr", "length"], "Pieces"), sc = table(f.scans, ["tracking", "wr"], "Scanned parcels");
  const sh = table(f.ships, ["id", "ship_type", "name"], "Shipments"), sp = table(f.shipPieces, ["shipment", "item"], "Shipment pieces");
  const empty: CargoResult = { receipts: 0, pieces: 0, scans: 0, ships: 0, shipPieces: 0, orphanPieces: 0, orphanScans: 0, problems: [] };
  const bad = rc.error || pc.error || sc.error || sh.error || sp.error;
  if (bad) return { wrs: [], ships: [], result: empty, error: bad };

  const byWr = new Map<string, OldWR>();
  for (const r of rc.rows) if (r.wr) byWr.set(r.wr, { wr: r.wr, date: r.date, shipper: r.shipper ?? "", billTo: Math.round(num(r.bill_to)), cust: Math.round(num(r.customer_no)), ship: r.ship_type ?? "", kind: r.category ?? "", handling: r2(num(r.handling)), other: r2(num(r.other_fees)), credit: r2(num(r.credit)), paid: r2(num(r.payment_received)), method: r.pay_method ?? "", contents: r.contents ?? "", comments: r.comments ?? "", invoiced: yes(r.invoiced), paidFull: yes(r.paid_in_full), pieces: [], scans: [], ships: [] });
  const wrOfItem = new Map<number, string>();
  let orphanPieces = 0, orphanScans = 0, stubs = 0;
  for (const p of pc.rows) { const o = byWr.get(p.wr); const n = Math.round(num(p.item)); if (!o) { orphanPieces++; continue; } wrOfItem.set(n, p.wr); o.pieces.push({ n, type: p.type ?? "", l: num(p.length), w: num(p.width), h: num(p.height), lbs: num(p.weight), cuft: num(p.cuft), contents: p.contents ?? "", loaded: yes(p.loaded), shipped: yes(p.shipped), delivered: yes(p.delivered) }); }
  for (const s of sc.rows) {
    let o = byWr.get(s.wr);
    if (!o) {
      // The parcel was scanned for a receipt that is not in the receipts file (deleted in the old system): keep a stub so the tracking number can still be found.
      if (!s.wr) { orphanScans++; continue; }
      o = { wr: s.wr, date: s.date ?? "", shipper: "", billTo: 0, cust: Math.round(num(s.customer_no)), ship: s.ship_type ?? "", kind: "(receipt not in the old file: parcels only)", handling: 0, other: 0, credit: 0, paid: 0, method: "", contents: "", comments: "", invoiced: false, paidFull: false, pieces: [], scans: [], ships: [] };
      byWr.set(s.wr, o); stubs++;
    }
    o.scans.push({ t: s.tracking, date: s.date ?? "", carrier: s.carrier ?? "", ship: s.ship_type ?? "", notified: yes(s.notified) }); }
  const ships = new Map<string, OldShip>();
  for (const r of sh.rows) if (r.id) ships.set(r.id, { id: r.id, type: r.ship_type ?? "", name: r.name ?? "", awb: r.awb ?? "", bol: r.bol ?? "", date: r.date ?? "", sail: r.sail_date ?? "", arrival: r.arrival_date ?? "", container: r.container ?? "", line: r.line ?? "", vessel: r.vessel ?? "", pieces: Math.round(num(r.pieces)), cost: r2(num(r.bl_cost)), shipper: r.shipper ?? "", consignee: r.consignee ?? "", items: [] });
  let linked = 0;
  for (const x of sp.rows) {
    const s = ships.get(x.shipment), n = Math.round(num(x.item)); if (!s) continue; s.items.push(n); linked++;
    const wr = wrOfItem.get(n); if (wr) { const o = byWr.get(wr)!; if (!o.ships.includes(s.id)) o.ships.push(s.id); }
  }
  const problems: string[] = [];
  if (orphanPieces) problems.push(`${orphanPieces} pieces belong to a receipt that is not in the file (ignored).`);
  if (stubs) problems.push(`${stubs} receipts are only known from their scanned parcels (they are not in the receipts file): kept, with the parcels only.`);
  if (orphanScans) problems.push(`${orphanScans} scanned parcels have no receipt number (ignored).`);
  const wrs = [...byWr.values()].sort((a, b) => Number(a.wr) - Number(b.wr));
  return { wrs, ships: [...ships.values()].sort((a, b) => Number(a.id) - Number(b.id)), result: { receipts: wrs.length, pieces: pc.rows.length - orphanPieces, scans: sc.rows.length - orphanScans, ships: ships.size, shipPieces: linked, orphanPieces, orphanScans, problems } };
}

// Finds a tracking number in the old scans (tolerant: the tail of a long barcode matches).
let index: { wrs: OldWR[]; map: Map<string, { wr: string; date: string; carrier: string }[]> } | null = null;
export function oldScanIndex(wrs: OldWR[]) {
  if (index && index.wrs === wrs) return index.map; // the list is replaced as a whole by an import or a refresh
  const map = new Map<string, { wr: string; date: string; carrier: string }[]>();
  for (const w of wrs) for (const s of w.scans) { const k = s.t.slice(-12); (map.get(k) ?? map.set(k, []).get(k)!).push({ wr: w.wr, date: s.date, carrier: s.carrier }); }
  index = { wrs, map };
  return map;
}
