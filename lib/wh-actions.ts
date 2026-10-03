"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db, findPiece, nowStr, balance, money, type Ship } from "./wh-store";
import { syncEnabled, findClientId, pushStatus } from "./jps-sync";

type F = FormData;
const s = (f: F, k: string) => String(f.get(k) ?? "").trim();
const num = (f: F, k: string) => Number(f.get(k));
const back = (path: string, q: Record<string, string> = {}): never => {
  const qs = new URLSearchParams(q).toString();
  return redirect(qs ? `${path}?${qs}` : path);
};
const shipOf = (v: string): Ship => (v === "Ocean" ? "Ocean" : "Air");
const wrPath = (id: string) => `/warehouse/receipts/${id}`;
const RX = "/warehouse/receiving", PL = "/warehouse/pallets";

// ---------- Received items: one delivery = one scanning session ----------
type Sess = { batch: string; date: string; carrier: string; receiver: string };
const readSess = async (): Promise<Sess | null> => { try { return JSON.parse((await cookies()).get("rcv")?.value ?? "null"); } catch { return null; } };
const cleanTracking = (v: string) => v.toUpperCase().replace(/\s+/g, "");

export async function startDelivery(f: F) {
  const carrier = s(f, "carrier").toUpperCase(), receiver = s(f, "receiver");
  const d = new Date(s(f, "date") + "T00:00");
  if (!carrier || !receiver || isNaN(d.getTime())) back(RX, { err: "Choose the date, the carrier and who is receiving." });
  const jar = await cookies();
  jar.set("rcv", JSON.stringify({ batch: String(db.n.batch++), date: d.toLocaleDateString("en-US"), carrier, receiver }), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 16 });
  jar.set("rcv_name", receiver, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  back(RX);
}
export async function endDelivery() {
  const sess = await readSess();
  (await cookies()).delete("rcv");
  const n = sess ? db.items.filter((i) => i.batch === sess.batch).length : 0;
  back(RX, sess ? { ok: `Delivery closed: ${n} parcel${n === 1 ? "" : "s"} from ${sess.carrier}.` } : {});
}
export async function receiveItem(f: F) {
  const sess = await readSess();
  if (!sess) back(RX, { err: "Start a delivery first." });
  const tracking = cleanTracking(s(f, "tracking"));
  if (tracking.length < 6) back(RX, { err: "That doesn't look like a tracking number. Scan it again." });
  const dup = db.items.find((i) => i.tracking === tracking);
  if (dup) back(RX, { err: `DUPLICATE: ${tracking} was already accepted on ${dup.date} (${dup.carrier}, received by ${dup.receiver}). Not counted.` });
  db.items.push({ id: db.n.item++, date: sess!.date, carrier: sess!.carrier, receiver: sess!.receiver, batch: sess!.batch, tracking });
  back(RX, { ok: tracking });
}
export async function updateItem(f: F) {
  const it = db.items.find((i) => i.id === num(f, "id")), tracking = cleanTracking(s(f, "tracking"));
  if (!it) return;
  if (tracking.length < 6) back(RX, { err: "The tracking number is too short." });
  if (db.items.some((i) => i.tracking === tracking && i.id !== it.id)) back(RX, { err: `${tracking} already exists.` });
  it.tracking = tracking;
  it.carrier = s(f, "carrier").toUpperCase() || it.carrier;
  back(RX, { ok: tracking });
}
export async function deleteItem(f: F) {
  const it = db.items.find((i) => i.id === num(f, "id"));
  if (it?.piece) back(RX, { err: `${it.tracking} is part of piece ${it.piece}. Delete that piece first.` });
  db.items = db.items.filter((i) => i.id !== num(f, "id"));
  revalidatePath(RX);
}

// ---------- Consolidation: parcels -> JP's pieces ----------
const CO = "/warehouse/consolidate";
async function assign(ids: number[], f: F) {
  const items = db.items.filter((i) => ids.includes(i.id) && !i.piece);
  const customer = s(f, "customer"), ship = shipOf(s(f, "ship"));
  if (!items.length) return back(CO, { err: "Select at least one parcel that is not assigned yet." });
  if (!customer) return back(CO, { err: "Enter the customer." });
  const p = pieceInput(f);
  if (typeof p === "string") return back(CO, { err: p });
  let name = customer, email = "", clientId: string | undefined, warn = "";
  if (syncEnabled()) {
    const r = await findClientId(customer);
    if (r.id) { clientId = r.id; name = r.name ?? customer; email = r.email ?? ""; }
    else warn = `${r.error} The customer won't see this on the website.`;
  }
  // Reuse the customer's open receipt (same ship type, not invoiced, nothing loaded yet), otherwise open a new one.
  let w = db.wrs.find((x) => x.customer.toLowerCase() === name.toLowerCase() && x.ship === ship && !x.invoice && !x.pieces.some((pc) => db.loads.some((l) => l.no === pc.no)));
  if (!w) {
    w = { id: String(db.n.wr++), date: nowStr(), customer: name, email, route: "", ship, comments: "", subtotal: 0, handling: 0, other: 0, declared: 0, insurance: "Declined", payments: [], pieces: [] };
    db.wrs.unshift(w);
  } else if (!w.email && email) w.email = email;
  const no = db.n.piece++;
  w.pieces.push({ no, ...p });
  for (const i of items) Object.assign(i, { customer: name, piece: no, wr: w.id, clientId, ship });
  // Website status 0 "received in Miami": the customer gets the push + e-mail now that we know who it belongs to.
  if (clientId) for (const i of items) {
    const e = await pushStatus({ tracking: i.tracking, status: 0, clientId, type: ship, description: `JP's ${no}` });
    if (e) warn = `Piece created, but the website update failed: ${e}`;
  }
  return back(CO, { ok: `Piece ${no} created for ${name} (JPF-${w.id}) from ${items.length} parcel${items.length > 1 ? "s" : ""}.`, wr: w.id, piece: String(no), ...(warn && { warn }) });
}
export async function singlePiece(f: F) { return assign([num(f, "id")], f); }
export async function combinePieces(f: F) { return assign(f.getAll("id").map(Number), f); }

// ---------- Warehouse receipts ----------
const emailOk = (e: string) => !e || /^\S+@\S+\.\S+$/.test(e);
export async function createWR(f: F) {
  const customer = s(f, "customer"), email = s(f, "email");
  if (!customer) back("/warehouse/receipts", { err: "Enter the customer name." });
  if (!emailOk(email)) back("/warehouse/receipts", { err: "That email address isn't valid." });
  const id = String(db.n.wr++);
  db.wrs.unshift({ id, date: nowStr(), customer, email, route: s(f, "route").toUpperCase(), ship: shipOf(s(f, "ship")), comments: s(f, "comments"), subtotal: 0, handling: 0, other: 0, declared: 0, insurance: "Declined", payments: [], pieces: [] });
  back(wrPath(id));
}
export async function updateWR(f: F) {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  const [subtotal, handling, other, declared] = [num(f, "subtotal") || 0, num(f, "handling") || 0, num(f, "other") || 0, num(f, "declared") || 0];
  if ([subtotal, handling, other, declared].some((v) => v < 0)) back(wrPath(w.id), { err: "Charges and declared value can't be negative." });
  if (!emailOk(s(f, "email"))) back(wrPath(w.id), { err: "That email address isn't valid." });
  Object.assign(w, { subtotal, handling, other, declared, insurance: s(f, "insurance") === "Accepted" ? "Accepted" : "Declined", comments: s(f, "comments"), route: s(f, "route").toUpperCase(), email: s(f, "email") });
  back(wrPath(w.id), { ok: "Receipt saved." });
}
function pieceInput(f: F) {
  const [l, w, h, lbs] = [num(f, "l"), num(f, "w"), num(f, "h"), num(f, "lbs")];
  if (![l, w, h, lbs].every((v) => Number.isFinite(v) && v > 0)) return "Enter the weight and all three dimensions (more than 0).";
  if (Math.max(l, w, h) > 200) return "A dimension can't be more than 200 in.";
  if (lbs > 2000) return "Weight can't be more than 2000 lb.";
  return { type: s(f, "type").toUpperCase() || "BOX - OTHER", l, w, h, lbs };
}
export async function addPiece(f: F) {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  const p = pieceInput(f);
  if (typeof p === "string") back(wrPath(w.id), { err: p });
  else w.pieces.push({ no: db.n.piece++, ...p });
  back(wrPath(w.id));
}
export async function updatePiece(f: F) {
  const w = db.wrs.find((x) => x.id === s(f, "wr")), no = num(f, "no");
  const piece = w?.pieces.find((x) => x.no === no);
  if (!w || !piece) return;
  if (db.loads.some((l) => l.no === no)) back(wrPath(w.id), { err: `Piece ${no} is already loaded. Remove it from the pallet first.` });
  const p = pieceInput(f);
  if (typeof p === "string") back(wrPath(w.id), { err: p });
  else Object.assign(piece, p);
  back(wrPath(w.id), { ok: `Piece ${no} updated.` });
}
export async function deletePiece(f: F) {
  const w = db.wrs.find((x) => x.id === s(f, "wr")), no = num(f, "no");
  if (!w) return;
  if (db.loads.some((l) => l.no === no)) back(wrPath(w.id), { err: `Piece ${no} is already loaded. Remove it from the pallet first.` });
  db.items.forEach((i) => { if (i.piece === no) Object.assign(i, { piece: undefined, wr: undefined, customer: undefined, clientId: undefined }); });
  w.pieces = w.pieces.filter((x) => x.no !== no);
  back(wrPath(w.id), { ok: `Piece ${no} deleted.` });
}
export async function createInvoice(f: F) {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  if (!w.pieces.length) back(wrPath(w.id), { err: "Add at least one piece before invoicing." });
  if (!w.invoice) w.invoice = `INV-${db.n.inv++}`;
  back(wrPath(w.id), { ok: `Invoice ${w.invoice} created.` });
}
export async function addPayment(f: F) {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  const amount = num(f, "amount");
  if (!Number.isFinite(amount) || amount <= 0) back(wrPath(w.id), { err: "Enter a payment amount more than 0." });
  if (amount > balance(w) + 0.001) back(wrPath(w.id), { err: `That's more than the balance of ${money(balance(w))}.` });
  w.payments.push({ date: nowStr(), amount, method: s(f, "method") || "Cash", ref: s(f, "ref") });
  back(wrPath(w.id), { ok: `Payment of ${money(amount)} added.` });
}

// ---------- Pallets / containers / cargo ----------
export async function loadPiece(f: F) {
  const shipment = s(f, "shipment"), pallet = s(f, "pallet"), ship = shipOf(s(f, "ship"));
  const q = { shipment, pallet, ship };
  const no = Number(s(f, "code").split("|").pop());
  const hit = findPiece(no);
  if (!shipment || !pallet) back(PL, { ...q, err: "Enter the shipment and the pallet or container." });
  if (!hit) back(PL, { ...q, err: `Piece "${s(f, "code")}" not found. Scan the piece label.` });
  if (db.loads.some((l) => l.no === no)) back(PL, { ...q, err: `Piece ${no} is already loaded.` });
  let sh = db.shipments.find((x) => x.name === shipment);
  if (!sh) { sh = { name: shipment, ship, cargoId: String(db.n.cargo++), date: nowStr() }; db.shipments.push(sh); }
  if (sh.shipped) back(PL, { ...q, err: `${shipment} was already shipped.` });
  if (hit!.w.ship !== sh.ship) back(PL, { ...q, ship: sh.ship, err: `Piece ${no} is ${hit!.w.ship} but ${shipment} is ${sh.ship}.` });
  db.loads.push({ shipment, pallet, wr: hit!.w.id, no, date: nowStr() });
  back(PL, { ...q, ship: sh.ship, ok: String(no) });
}
export async function unloadPiece(f: F) {
  const l = db.loads.find((x) => x.no === num(f, "no"));
  if (l && !db.shipments.find((x) => x.name === l.shipment)?.shipped) db.loads = db.loads.filter((x) => x !== l);
  revalidatePath(PL);
}
export async function shipCargo(f: F) {
  const sh = db.shipments.find((x) => x.name === s(f, "shipment"));
  const q = { shipment: s(f, "shipment"), pallet: s(f, "pallet"), ship: s(f, "ship") };
  if (!sh || sh.shipped) return;
  const loads = db.loads.filter((l) => l.shipment === sh.name);
  if (!loads.length) back(PL, { ...q, err: "Load at least one piece before shipping." });
  sh.shipped = nowStr();
  const wrIds = new Set(loads.map((l) => l.wr));
  const mine = db.items.filter((i) => i.wr && wrIds.has(i.wr));
  mine.forEach((i) => { i.shipped = true; });
  // Tracking website: status 1 "in transit / customs" for every linked parcel of these receipts.
  let failed = 0;
  for (const i of mine) if (i.clientId && await pushStatus({ tracking: i.tracking, status: 1, clientId: i.clientId })) failed++;
  back(PL, { ...q, ok: `${sh.name} shipped (Cargo ID ${sh.cargoId}).`, ...(failed && { warn: `${failed} parcel(s) could not be updated on the website.` }) });
}

// ---------- Arrivals in Pétion-Ville ----------
const AR = "/warehouse/arrivals";
// Website status 2 "arrived in Haiti" once EVERY piece of a receipt is here (a partial arrival changes nothing).
async function syncArrived(wrIds: string[]) {
  let failed = 0;
  for (const id of wrIds) {
    const w = db.wrs.find((x) => x.id === id);
    if (!w || !w.pieces.length || !w.pieces.every((p) => db.loads.some((l) => l.no === p.no && l.here))) continue;
    for (const i of db.items) if (i.wr === id && i.clientId && await pushStatus({ tracking: i.tracking, status: 2, clientId: i.clientId })) failed++;
  }
  return failed;
}
export async function receiveHere(f: F) {
  const raw = s(f, "code"), no = Number(raw.split("|").pop());
  const l = db.loads.find((x) => x.no === no);
  if (!l) back(AR, { err: `Piece "${raw}" was never loaded on a shipment. Check the label.` });
  if (!db.shipments.find((x) => x.name === l!.shipment)?.shipped) back(AR, { err: `Piece ${no} is on ${l!.shipment}, which hasn't shipped yet.` });
  if (l!.here) back(AR, { err: `Piece ${no} was already received here on ${l!.here}.` });
  l!.here = nowStr();
  const failed = await syncArrived([l!.wr]);
  back(AR, { ok: `Piece ${no} received.`, ...(failed && { warn: `${failed} parcel(s) could not be updated on the website.` }) });
}
export async function arriveShipment(f: F) {
  const name = s(f, "shipment");
  if (!db.shipments.find((x) => x.name === name)?.shipped) return;
  const touched = new Set<string>();
  db.loads.forEach((l) => { if (l.shipment === name && !l.here) { l.here = nowStr(); touched.add(l.wr); } });
  const failed = await syncArrived([...touched]);
  back(AR, { ok: `All pieces of ${name} are marked as here.`, ...(failed && { warn: `${failed} parcel(s) could not be updated on the website.` }) });
}
export async function markHereNotified(f: F) {
  // Email sending is not wired yet: this only records that the customer was told.
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (w) w.hereNotified = true;
  revalidatePath(AR);
}

// Website status 3 "ready for pickup".
export async function markReady(f: F) {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  w.ready = true;
  let failed = 0;
  for (const i of db.items) if (i.wr === w.id && i.clientId && await pushStatus({ tracking: i.tracking, status: 3, clientId: i.clientId })) failed++;
  back(AR, { ok: `JPF-${w.id} is ready for pickup.`, ...(failed && { warn: `${failed} parcel(s) could not be updated on the website.` }) });
}
