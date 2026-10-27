// Where is the parcel? One search (tracking number, receipt / WR number, customer name or number, phone, e-mail, piece number, label code, shipment name)
// finds the receipts and parcels and follows each one step by step, from "received at the warehouse" to "ready for pickup".
// Pure functions over the working copy (no writes): used by the Track page.
import { db, wrCode, toUSA, shToUSA, balance, money, r2, type WR, type Item, type Load, type Shipment, type Customer, type Prealert, type OldWR } from "./wh-store";
import { extractTracking, sameTracking } from "./tracking";
import { nextDeparture } from "./schedule";
import { oldScanIndex } from "./cargo-import";
import { HAITI, COMPANY } from "./company";

export type Step = { key: string; label: string; done: boolean; when?: string; by?: string; detail?: string };
export type WrTrack = { w: WR; usa: boolean; items: Item[]; loads: Load[]; shipments: Shipment[]; here: number; total: number; stage: number; state: string; steps: Step[] };
export type TrackResult = { query: string; customers: Customer[]; wrs: WrTrack[]; more: number; loose: Item[]; prealerts: Prealert[]; old: { wr: string; date: string; shipper: string; why: string }[]; shipmentHits: Shipment[] };

const day = (us: string) => us; // dates are kept as M/D/YYYY
const uniq = <T,>(a: T[]) => [...new Set(a)];
const last = <T,>(a: T[]) => a[a.length - 1];

// The steps of one receipt. `stage`: 0 nothing yet, 1 at the warehouse, 2 receipt made, 3 loaded, 4 shipped, 5 arrived, 6 ready for pickup.
export function followReceipt(w: WR): WrTrack {
  const usa = toUSA(w), items = db.items.filter((i) => i.wr === w.id), nos = new Set(w.pieces.map((p) => p.no));
  const loads = db.loads.filter((l) => nos.has(l.no)), shipments = uniq(loads.map((l) => l.shipment)).map((n) => db.shipments.find((s) => s.name === n)).filter((s): s is Shipment => !!s);
  const total = w.pieces.length, loaded = loads.length, here = loads.filter((l) => l.here).length, shippedAll = shipments.length > 0 && shipments.every((s) => s.shipped);
  const dest = usa ? "Miami" : "Haiti", office = usa ? "Haiti office" : "Miami warehouse";
  const dep = w.pieces.length && !shippedAll ? nextDeparture(w.ship).departure : "";
  const steps: Step[] = [
    { key: "received", label: `Parcel received at the ${office}`, done: items.length > 0 || w.pieces.length > 0 || !!w.date, when: items.length ? day(items[0].date) : day(w.date), by: items.find((i) => i.by)?.by ?? w.by,
      detail: items.length ? items.map((i) => `${i.tracking}${i.made ? " (number made here)" : ""} · ${i.carrier}`).join(" | ") : "No scanned parcel is linked (the receipt was made by hand)." },
    { key: "pieces", label: "Receipt and pieces made", done: total > 0, when: day(w.date), by: w.by, detail: total ? `${wrCode(w)} · ${total} piece${total > 1 ? "s" : ""}, ${r2(w.pieces.reduce((a, p) => a + p.lbs, 0))} lb · ${w.ship === "Air" ? "Air" : "Ocean"}${w.dest ? ` · to ${w.dest}` : ""}` : "No piece yet." },
    { key: "loaded", label: "Loaded on a shipment", done: loaded > 0, when: loaded ? day(last(loads).date) : undefined, by: last(loads)?.by, detail: loaded ? `${loaded} of ${total} loaded · ${loads.map((l) => `${l.shipment} / ${l.pallet}`).filter((x, i, a) => a.indexOf(x) === i).join(", ")}` : dep ? `Waiting. Next ${w.ship} departure: ${dep}.` : "Waiting." },
    { key: "shipped", label: shippedAll ? `Left ${usa ? "Haiti" : "Miami"}` : "Shipped", done: shippedAll, when: shippedAll ? day(last(shipments.map((s) => s.shipped!))) : undefined, by: shippedAll ? last(shipments).shippedBy : undefined, detail: shipments.length ? shipments.map((s) => `${s.name}${s.shipped ? ` · left ${s.shipped}` : " · not left yet"}`).join(", ") : "Not on a shipment yet." },
    { key: "arrived", label: `Arrived in ${dest}`, done: total > 0 && here === total, when: here ? day(last(loads.filter((l) => l.here)).here!) : undefined, by: last(loads.filter((l) => l.here))?.hereBy, detail: total ? (here ? `${here} of ${total} piece${total > 1 ? "s" : ""} received` : shippedAll ? `In transit: not received in ${dest} yet.` : "Not shipped yet.") : "" },
    { key: "ready", label: "Ready for pickup / delivery", done: !!w.ready, detail: w.ready ? "The customer was told." : "" },
    { key: "invoice", label: "Invoice and payment", done: !!w.invoice && balance(w) <= 0, detail: w.estimate ? "This receipt is an estimate." : w.invoice ? `${w.invoice}${balance(w) > 0 ? ` · balance ${money(balance(w))}` : " · paid"}` : "Not invoiced yet (the invoice is made after customs and delivery)." },
  ];
  const stage = w.ready ? 6 : total > 0 && here === total ? 5 : shippedAll ? 4 : loaded > 0 ? 3 : total > 0 ? 2 : 1;
  const state = w.ready ? `Ready for pickup in ${dest}` : stage === 5 ? `Arrived in ${dest}` : here > 0 ? `${here} of ${total} pieces arrived in ${dest}, the rest is on its way` : stage === 4 ? `In transit to ${dest}` : stage === 3 ? (loaded < total ? `Loading: ${loaded} of ${total} pieces on a shipment` : `Loaded, waiting for departure${dep ? ` (${dep})` : ""}`) : stage === 2 ? `At our ${office}, not loaded yet${dep ? ` (next departure ${dep})` : ""}` : `Received at our ${office}`;
  return { w, usa, items, loads, shipments, here, total, stage, state, steps };
}

// What to write back to a customer who asks where the parcel is (fr / en / es), from the real state of the receipt.
export function customerMessage(t: WrTrack, lang: "fr" | "en" | "es"): string {
  const w = t.w, code = wrCode(w), usa = t.usa, trk = t.items.map((i) => i.tracking).slice(0, 3).join(", "), n = t.total;
  const dest = { fr: usa ? "Miami" : "Haïti", en: usa ? "Miami" : "Haiti", es: usa ? "Miami" : "Haití" }[lang];
  const dep = nextDeparture(w.ship).departure;
  const hello = { fr: `Bonjour ${w.customer},`, en: `Hello ${w.customer},`, es: `Hola ${w.customer},` }[lang];
  const ref = { fr: `Votre reçu ${code}${trk ? ` (colis ${trk})` : ""}`, en: `Your receipt ${code}${trk ? ` (parcel ${trk})` : ""}`, es: `Su recibo ${code}${trk ? ` (paquete ${trk})` : ""}` }[lang];
  const office = usa ? { fr: "notre bureau d'Haïti", en: "our Haiti office", es: "nuestra oficina de Haití" }[lang] : { fr: "notre entrepôt de Miami", en: "our Miami warehouse", es: "nuestro depósito de Miami" }[lang];
  const pickup = usa ? `${COMPANY.name}, ${COMPANY.address}, ${COMPANY.city}, ${COMPANY.phone}` : `${HAITI.name}, ${HAITI.address}, ${HAITI.city}, ${HAITI.phone}`;
  const lines: Record<number, Record<string, string>> = {
    1: { fr: `${ref} a bien été reçu à ${office}.`, en: `${ref} was received at ${office}.`, es: `${ref} fue recibido en ${office}.` },
    2: { fr: `${ref} est à ${office} (${n} pièce${n > 1 ? "s" : ""}). Il partira avec le prochain envoi ${w.ship === "Air" ? "par avion" : "par bateau"} (départ prévu : ${dep}).`, en: `${ref} is at ${office} (${n} piece${n > 1 ? "s" : ""}). It will leave with the next ${w.ship === "Air" ? "air" : "ocean"} shipment (planned departure: ${dep}).`, es: `${ref} está en ${office} (${n} pieza${n > 1 ? "s" : ""}). Saldrá con el próximo envío ${w.ship === "Air" ? "aéreo" : "marítimo"} (salida prevista: ${dep}).` },
    3: { fr: `${ref} est chargé sur l'envoi ${t.shipments.map((s) => s.name).join(", ")} et partira bientôt.`, en: `${ref} is loaded on shipment ${t.shipments.map((s) => s.name).join(", ")} and will leave soon.`, es: `${ref} está cargado en el envío ${t.shipments.map((s) => s.name).join(", ")} y saldrá pronto.` },
    4: { fr: `${ref} est parti${t.shipments[0]?.shipped ? ` le ${t.shipments[0].shipped}` : ""} et est en transit vers ${dest}. Nous vous prévenons dès son arrivée.`, en: `${ref} left${t.shipments[0]?.shipped ? ` on ${t.shipments[0].shipped}` : ""} and is in transit to ${dest}. We will tell you as soon as it arrives.`, es: `${ref} salió${t.shipments[0]?.shipped ? ` el ${t.shipments[0].shipped}` : ""} y va en tránsito a ${dest}. Le avisaremos en cuanto llegue.` },
    5: { fr: `${ref} est arrivé en ${dest}. Il sera bientôt prêt pour le retrait ou la livraison.`, en: `${ref} has arrived in ${dest}. It will soon be ready for pickup or delivery.`, es: `${ref} llegó a ${dest}. Pronto estará listo para retiro o entrega.` },
    6: { fr: `${ref} est prêt pour le retrait / la livraison. Bureau : ${pickup}.`, en: `${ref} is ready for pickup / delivery. Office: ${pickup}.`, es: `${ref} está listo para retiro / entrega. Oficina: ${pickup}.` },
  };
  const partial = t.here > 0 && t.here < t.total ? { fr: ` (${t.here} pièce(s) sur ${t.total} déjà arrivée(s))`, en: ` (${t.here} of ${t.total} pieces already arrived)`, es: ` (${t.here} de ${t.total} piezas ya llegaron)` }[lang] : "";
  const bye = { fr: "Cordialement,\nJP's Logistics & More", en: "Best regards,\nJP's Logistics & More", es: "Atentamente,\nJP's Logistics & More" }[lang];
  return `${hello}\n\n${(lines[t.stage] ?? lines[1])[lang]}${t.stage === 4 || t.stage === 3 ? partial : ""}\n\n${bye}`;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const digits = (s: string) => s.replace(/\D/g, "");

export function track(query: string): TrackResult {
  const q = query.trim(), res: TrackResult = { query: q, customers: [], wrs: [], more: 0, loose: [], prealerts: [], old: [], shipmentHits: [] };
  if (q.length < 2) return res;
  const wrIds = new Set<string>(), looseIds = new Set<number>(), lower = norm(q), dg = digits(q), compact = q.replace(/[\s-]+/g, "").toUpperCase();
  // 1. A receipt number: 11023, JPL-11023, JPF 11023, an invoice number, or the label code customer|receipt|piece.
  const label = q.split("|").map((x) => x.trim());
  if (label.length === 3 && /^\d+$/.test(label[1])) wrIds.add(label[1]);
  const wrNo = compact.match(/^(?:JP[FL])?(\d{5,6})$/)?.[1];
  if (wrNo) { if (db.wrs.some((w) => w.id === wrNo)) wrIds.add(wrNo); }
  if (/^INV-?\d+$/.test(compact)) { const inv = compact.replace(/^INV-?/, "INV-"); db.wrs.filter((w) => w.invoice === inv).forEach((w) => wrIds.add(w.id)); }
  // 2. A piece number (JP's piece), 5+ digits that is not a receipt.
  if (/^\d{5,}$/.test(dg) && /^\d+$/.test(compact)) { const no = Number(dg); db.wrs.forEach((w) => { if (w.pieces.some((p) => p.no === no)) wrIds.add(w.id); }); }
  // 3. A tracking number (whole, tail of a long barcode, or its last digits), also the numbers made here (JPS0000004).
  const tk = extractTracking(q), tail = compact.length >= 6 ? compact : "";
  for (const i of db.items) {
    const t = i.tracking.toUpperCase();
    if ((tk && sameTracking(i.tracking, tk)) || (tail && (t.includes(tail) || tail.includes(t) && t.length >= 8))) { if (i.wr) wrIds.add(i.wr); else looseIds.add(i.id); }
  }
  // 4. A customer: number, name, phone, e-mail or website box.
  const phone = dg.length >= 6 ? dg : "";
  const custs = db.customers.filter((c) => (/^\d{3,6}$/.test(q) && c.no === Number(q)) || (lower.length >= 3 && [c.name, c.email, c.box ?? "", c.consignee].some((v) => v && norm(v).includes(lower))) || (phone && [c.phone, c.consigneePhone, c.altPhone ?? "", c.whatsapp ?? ""].some((v) => v && digits(v).includes(phone))));
  res.customers = custs.slice(0, 8);
  if (custs.length && custs.length <= 8) for (const c of custs) { db.wrs.filter((w) => w.cust === c.no).forEach((w) => wrIds.add(w.id)); db.items.filter((i) => !i.wr && (i.customer === c.name)).forEach((i) => looseIds.add(i.id)); }
  // 5. A shipment name (PL-AIR-10-16-2026): its receipts.
  res.shipmentHits = lower.length >= 4 ? db.shipments.filter((s) => norm(s.name).includes(lower)).slice(0, 5) : [];
  for (const s of res.shipmentHits) { const nos = new Set(db.loads.filter((l) => l.shipment === s.name).map((l) => l.wr)); nos.forEach((id) => wrIds.add(id)); }
  const all = [...wrIds].map((id) => db.wrs.find((w) => w.id === id)).filter((w): w is WR => !!w).sort((a, b) => Number(b.id) - Number(a.id));
  res.wrs = all.slice(0, 20).map(followReceipt); res.more = Math.max(0, all.length - 20);
  res.loose = [...looseIds].map((id) => db.items.find((i) => i.id === id)).filter((i): i is Item => !!i).slice(0, 20);
  res.prealerts = db.prealerts.filter((p) => p.status === "Expected" && ((tk && sameTracking(p.tracking, tk)) || (tail && p.tracking.toUpperCase().includes(tail)) || custs.some((c) => c.no === p.cust))).slice(0, 10);
  // 6. The old system (history): a tracking number scanned there, an old receipt number, or the shipper.
  if (db.oldWrs.length) {
    const seen = new Set<string>(), hits: TrackResult["old"] = [];
    if (tk.length >= 8) for (const h of oldScanIndex(db.oldWrs).get(tk.slice(-12)) ?? []) if (!seen.has(h.wr)) { seen.add(h.wr); const o = db.oldWrs.find((x) => x.wr === h.wr); if (o) hits.push({ wr: o.wr, date: o.date, shipper: o.shipper, why: `parcel scanned on ${h.date || "?"} (${h.carrier})` }); }
    if (wrNo || /^\d{4,7}$/.test(compact)) for (const o of db.oldWrs) if ((o.wr === (wrNo ?? compact) || o.wr === compact) && !seen.has(o.wr)) { seen.add(o.wr); hits.push({ wr: o.wr, date: o.date, shipper: o.shipper, why: "old receipt number" }); }
    if (custs.length && custs.length <= 3) for (const c of custs) for (const o of db.oldWrs) if ((o.cust === c.no || o.billTo === c.no) && !seen.has(o.wr) && hits.length < 10) { seen.add(o.wr); hits.push({ wr: o.wr, date: o.date, shipper: o.shipper, why: "old receipt of this customer" }); }
    res.old = hits.slice(0, 10);
  }
  return res;
}
