"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db, findPiece, nowStr, balance, money, wrCode, r2, findCustomer, newCustomer, openWR, repOf, insuranceFee, openBooking, cargoOf, timeNow, remember as rememberName, type Ship, type WR, type Fee } from "./wh-store";
import { syncEnabled, findClientId, pushStatus } from "./jps-sync";
import { ensureLoaded, flush } from "./persist";
import { isoToUs } from "./clock";

// Every action: make sure the database copy is loaded, run it, then save what changed (also when it ends with a redirect).
const act = <A extends unknown[]>(fn: (...a: A) => Promise<void>) => async (...a: A): Promise<void> => {
  await ensureLoaded();
  try { await fn(...a); } finally { await flush(); }
};

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

export const startDelivery = act(async (f: F) => {
  const carrier = s(f, "carrier").toUpperCase(), receiver = s(f, "receiver");
  const d = new Date(s(f, "date") + "T00:00");
  if (!carrier || !receiver || isNaN(d.getTime())) back(RX, { err: "Choose the date, the carrier and who is receiving." });
  rememberName(db.carriers, carrier);
  const jar = await cookies();
  jar.set("rcv", JSON.stringify({ batch: String(db.n.batch++), date: isoToUs(s(f, "date")), carrier, receiver }), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 16 });
  jar.set("rcv_name", receiver, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  back(RX);
});
export const endDelivery = act(async () => {
  const sess = await readSess();
  (await cookies()).delete("rcv");
  const n = sess ? db.items.filter((i) => i.batch === sess.batch).length : 0;
  back(RX, sess ? { ok: `Delivery closed: ${n} parcel${n === 1 ? "" : "s"} from ${sess.carrier}.` } : {});
});
export const receiveItem = act(async (f: F) => {
  const sess = await readSess();
  if (!sess) back(RX, { err: "Start a delivery first." });
  const tracking = cleanTracking(s(f, "tracking"));
  if (tracking.length < 6) back(RX, { err: "That doesn't look like a tracking number. Scan it again." });
  const dup = db.items.find((i) => i.tracking === tracking);
  if (dup) back(RX, { err: `DUPLICATE: ${tracking} was already accepted on ${dup.date} (${dup.carrier}, received by ${dup.receiver}). Not counted.` });
  db.items.push({ id: db.n.item++, date: sess!.date, carrier: sess!.carrier, receiver: sess!.receiver, batch: sess!.batch, tracking });
  back(RX, { ok: tracking });
});
export const updateItem = act(async (f: F) => {
  const it = db.items.find((i) => i.id === num(f, "id")), tracking = cleanTracking(s(f, "tracking"));
  if (!it) return;
  if (tracking.length < 6) back(RX, { err: "The tracking number is too short." });
  if (db.items.some((i) => i.tracking === tracking && i.id !== it.id)) back(RX, { err: `${tracking} already exists.` });
  it.tracking = tracking;
  it.carrier = s(f, "carrier").toUpperCase() || it.carrier;
  back(RX, { ok: tracking });
});
export const deleteItem = act(async (f: F) => {
  const it = db.items.find((i) => i.id === num(f, "id"));
  if (it?.piece) back(RX, { err: `${it.tracking} is part of piece ${it.piece}. Delete that piece first.` });
  db.items = db.items.filter((i) => i.id !== num(f, "id"));
  revalidatePath(RX);
});

// ---------- Consolidation: parcels -> JP's pieces ----------
const CO = "/warehouse/consolidate";
async function assign(ids: number[], f: F) {
  const items = db.items.filter((i) => ids.includes(i.id) && !i.piece);
  const customer = s(f, "customer"), ship = shipOf(s(f, "ship"));
  const addToOpen = s(f, "receipt") === "open";
  if (!items.length) return back(CO, { err: "Select at least one parcel that is not assigned yet." });
  if (!customer) return back(CO, { err: "Enter the customer." });
  const p = pieceInput(f);
  if (typeof p === "string") return back(CO, { err: p });
  let clientId: string | undefined, warn = "", site: { name?: string; email?: string } = {};
  if (syncEnabled()) {
    const r = await findClientId(customer);
    if (r.id) { clientId = r.id; site = r; }
    else warn = `${r.error} The customer won't see this on the website.`;
  }
  // Our own customer record (number 1001, 1002, ...): found by number, e-mail or name, otherwise created now.
  let c = findCustomer(customer) ?? (site.name ? findCustomer(site.name) : undefined);
  const created = !c;
  if (!c) c = newCustomer(site.name ?? customer, { email: site.email ?? "" });
  else if (!c.email && site.email) c.email = site.email;
  // Every piece gets its own new warehouse receipt, unless staff chose to add it to the customer's open one
  // (same ship type, not invoiced, nothing loaded yet).
  const cno = c.no;
  let w = addToOpen ? db.wrs.find((x) => x.cust === cno && x.ship === ship && !x.invoice && !x.pieces.some((pc) => db.loads.some((l) => l.no === pc.no))) : undefined;
  if (!w) w = openWR(c, ship);
  const no = db.n.piece++;
  w.pieces.push({ no, ...p });
  for (const i of items) Object.assign(i, { customer: c.name, piece: no, wr: w.id, clientId, ship });
  // Website status 0 "received in Miami": the customer gets the push + e-mail now that we know who it belongs to.
  if (clientId) for (const i of items) {
    const e = await pushStatus({ tracking: i.tracking, status: 0, clientId, type: ship, description: `JP's ${no}` });
    if (e) warn = `Piece created, but the website update failed: ${e}`;
  }
  const note = created ? ` New customer ${c.no}: add the phone and address on the Customers page.` : "";
  return back(CO, { ok: `Piece ${no} created for ${c.name} (customer ${c.no}, ${wrCode(w)}${addToOpen ? "" : ", new receipt"}) from ${items.length} parcel${items.length > 1 ? "s" : ""}.${note}`, wr: w.id, piece: String(no), ...(warn && { warn }) });
}
export const singlePiece = act(async (f: F) => { await assign([num(f, "id")], f); });
export const combinePieces = act(async (f: F) => { await assign(f.getAll("id").map(Number), f); });

// ---------- Warehouse receipts ----------
const emailOk = (e: string) => !e || /^\S+@\S+\.\S+$/.test(e);
export const createWR = act(async (f: F) => {
  const name = s(f, "customer");
  if (!name) back("/warehouse/receipts", { err: "Choose or enter the customer." });
  const c = findCustomer(name) ?? newCustomer(name);
  const route = s(f, "route").toUpperCase();
  const w = openWR(c, shipOf(s(f, "ship")), { comments: s(f, "comments"), ...(route && { route }) });
  back(wrPath(w.id));
});
export const updateWR = act(async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  const declared = num(f, "declared") || 0;
  if (declared < 0) back(wrPath(w.id), { err: "Declared value can't be negative." });
  if (!emailOk(s(f, "email"))) back(wrPath(w.id), { err: "That email address isn't valid." });
  const ship = shipOf(s(f, "ship") || w.ship);
  if (ship !== w.ship && w.pieces.some((p) => db.loads.some((l) => l.no === p.no))) back(wrPath(w.id), { err: "Some pieces are already loaded on a shipment, so the ship type can't change." });
  if (ship !== w.ship) db.items.forEach((i) => { if (i.wr === w.id) i.ship = ship; });
  Object.assign(w, {
    declared, ship, rep: repOf(s(f, "rep")) ? s(f, "rep") : "", insurance: s(f, "insurance") === "Accepted" ? "Accepted" : "Declined",
    contents: s(f, "contents"), comments: s(f, "comments"), route: s(f, "route").toUpperCase(), email: s(f, "email"),
  });
  back(wrPath(w.id), { ok: "Receipt saved." });
});

// ---------- Fees and credits on a receipt ----------
const feeKind = (v: string): Fee["kind"] => (v === "credit" ? "credit" : "charge");
const feeSum = (fees: Fee[], k: Fee["kind"]) => fees.filter((x) => x.kind === k).reduce((a, x) => a + x.amount, 0);
const tooMuchCredit = (w: WR, fees: Fee[]) => r2(feeSum(fees, "charge") + insuranceFee(w) - feeSum(fees, "credit")) < 0;
// New fee names are remembered so they show up in the list next time.
const remember = (kind: Fee["kind"], label: string) => {
  const list = db.feeNames[kind];
  if (!list.some((n) => n.toLowerCase() === label.toLowerCase())) list.push(label);
};
const feeProblem = (label: string, amount: number) => {
  if (!label) return "Enter what the fee is for.";
  if (label.length > 60) return "The fee name is too long (60 characters max).";
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount more than 0.";
  if (amount > 100000) return "That amount is too large.";
  return "";
};
export const addFee = act(async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  const label = s(f, "label"), amount = num(f, "amount"), kind = feeKind(s(f, "kind"));
  const bad = feeProblem(label, amount);
  if (bad) back(wrPath(w.id), { err: bad });
  const fee: Fee = { id: db.n.fee++, label, amount: r2(amount), kind };
  if (tooMuchCredit(w, [...w.fees, fee])) back(wrPath(w.id), { err: "That credit is more than the charges on this receipt." });
  w.fees.push(fee);
  remember(kind, label);
  back(wrPath(w.id), { ok: `${kind === "credit" ? "Credit" : "Fee"} "${label}" added.` });
});
export const saveFees = act(async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  const next: Fee[] = [];
  for (const fee of w.fees) {
    const label = s(f, `label_${fee.id}`), amount = num(f, `amount_${fee.id}`), kind = feeKind(s(f, `kind_${fee.id}`));
    const bad = feeProblem(label, amount);
    if (bad) back(wrPath(w.id), { err: `${fee.label}: ${bad}` });
    next.push({ id: fee.id, label, amount: r2(amount), kind });
  }
  if (tooMuchCredit(w, next)) back(wrPath(w.id), { err: "Credits can't be more than the charges on this receipt." });
  w.fees = next;
  next.forEach((x) => remember(x.kind, x.label));
  back(wrPath(w.id), { ok: "Fees saved." });
});
// Bound from the page as deleteFee.bind(null, receiptId, feeId): a submit button with a function formAction can't carry a name/value.
export const deleteFee = act(async (wr: string, fee: number) => {
  const w = db.wrs.find((x) => x.id === wr);
  if (!w) return;
  const next = w.fees.filter((x) => x.id !== fee);
  if (tooMuchCredit(w, next)) back(wrPath(w.id), { err: "Remove the credit first: it would be more than the remaining charges." });
  w.fees = next;
  back(wrPath(w.id), { ok: "Fee removed." });
});

// ---------- Customers ----------
const CU = "/warehouse/customers";
const custFields = (f: F) => ({
  name: s(f, "name"), phone: s(f, "phone"), email: s(f, "email"), billing: s(f, "billing"),
  consignee: s(f, "consignee"), consigneePhone: s(f, "consigneePhone"), consigneeAddress: s(f, "consigneeAddress"),
  consigneeCity: s(f, "consigneeCity"), consigneeCountry: s(f, "consigneeCountry") || "Haiti",
  rep: repOf(s(f, "rep")) ? s(f, "rep") : "", route: s(f, "route").toUpperCase(),
});
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export const createCustomer = act(async (f: F) => {
  const d = custFields(f);
  if (!d.name) back(CU, { err: "Enter the customer's full name." });
  if (!emailOk(d.email)) back(CU, { err: "That email address isn't valid." });
  const dup = db.customers.find((x) => sameName(x.name, d.name));
  if (dup) back(`${CU}/${dup.no}`, { err: `${dup.name} already exists (customer ${dup.no}).` });
  const c = newCustomer(d.name, d);
  back(`${CU}/${c.no}`, { ok: `Customer ${c.no} created.` });
});
export const saveCustomer = act(async (f: F) => {
  const c = db.customers.find((x) => x.no === num(f, "no"));
  if (!c) return;
  const d = custFields(f), here = `${CU}/${c.no}`;
  if (!d.name) back(here, { err: "Enter the customer's full name." });
  if (!emailOk(d.email)) back(here, { err: "That email address isn't valid." });
  const dup = db.customers.find((x) => x !== c && sameName(x.name, d.name));
  if (dup) back(here, { err: `${dup.name} already exists (customer ${dup.no}).` });
  const oldEmail = c.email;
  Object.assign(c, d);
  // Keep this customer's receipts and parcels in step with the new name / e-mail.
  const mine = new Set<string>();
  for (const w of db.wrs) if (w.cust === c.no) { mine.add(w.id); w.customer = c.name; if (!w.email || w.email === oldEmail) w.email = c.email; }
  db.items.forEach((i) => { if (i.wr && mine.has(i.wr)) i.customer = c.name; });
  back(here, { ok: "Customer saved." });
});

// ---------- Representatives ----------
const RP = "/warehouse/reps";
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((x) => x[0]).join("").slice(0, 3).toUpperCase();
const repInput = (f: F) => { const name = s(f, "name"); return { name, initials: (s(f, "initials") || initialsOf(name)).toUpperCase().slice(0, 4) }; };
export const addRep = act(async (f: F) => {
  const { name, initials } = repInput(f);
  if (!name) back(RP, { err: "Enter the representative's name." });
  if (!initials) back(RP, { err: "Enter the initials." });
  if (db.reps.some((r) => r.initials === initials)) back(RP, { err: `The initials ${initials} are already used by another representative.` });
  db.reps.push({ id: String(db.n.rep++), name, initials });
  back(RP, { ok: `${name} (${initials}) added.` });
});
export const saveRep = act(async (f: F) => {
  const r = db.reps.find((x) => x.id === s(f, "id"));
  if (!r) return;
  const { name, initials } = repInput(f);
  if (!name || !initials) back(RP, { err: "Enter the name and the initials." });
  if (db.reps.some((x) => x !== r && x.initials === initials)) back(RP, { err: `The initials ${initials} are already used by another representative.` });
  Object.assign(r, { name, initials });
  back(RP, { ok: `${name} saved.` });
});
export const deleteRep = act(async (f: F) => {
  const r = db.reps.find((x) => x.id === s(f, "id"));
  if (!r) return;
  if (db.customers.some((c) => c.rep === r.id) || db.wrs.some((w) => w.rep === r.id)) back(RP, { err: `${r.name} still has customers or receipts. Give them to another representative first.` });
  db.reps = db.reps.filter((x) => x !== r);
  back(RP, { ok: `${r.name} removed.` });
});

function pieceInput(f: F) {
  const [l, w, h, lbs] = [num(f, "l"), num(f, "w"), num(f, "h"), num(f, "lbs")];
  if (![l, w, h, lbs].every((v) => Number.isFinite(v) && v > 0)) return "Enter the weight and all three dimensions (more than 0).";
  if (Math.max(l, w, h) > 200) return "A dimension can't be more than 200 in.";
  if (lbs > 2000) return "Weight can't be more than 2000 lb.";
  return { type: s(f, "type").toUpperCase() || "BOX - OTHER", l, w, h, lbs };
}
export const addPiece = act(async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  const p = pieceInput(f);
  if (typeof p === "string") back(wrPath(w.id), { err: p });
  else w.pieces.push({ no: db.n.piece++, ...p });
  back(wrPath(w.id));
});
export const updatePiece = act(async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr")), no = num(f, "no");
  const piece = w?.pieces.find((x) => x.no === no);
  if (!w || !piece) return;
  if (db.loads.some((l) => l.no === no)) back(wrPath(w.id), { err: `Piece ${no} is already loaded. Remove it from the pallet first.` });
  const p = pieceInput(f);
  if (typeof p === "string") back(wrPath(w.id), { err: p });
  else Object.assign(piece, p);
  back(wrPath(w.id), { ok: `Piece ${no} updated.` });
});
export const deletePiece = act(async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr")), no = num(f, "no");
  if (!w) return;
  if (db.loads.some((l) => l.no === no)) back(wrPath(w.id), { err: `Piece ${no} is already loaded. Remove it from the pallet first.` });
  db.items.forEach((i) => { if (i.piece === no) Object.assign(i, { piece: undefined, wr: undefined, customer: undefined, clientId: undefined }); });
  w.pieces = w.pieces.filter((x) => x.no !== no);
  back(wrPath(w.id), { ok: `Piece ${no} deleted.` });
});
export const createInvoice = act(async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  if (!w.pieces.length) back(wrPath(w.id), { err: "Add at least one piece before invoicing." });
  if (!w.invoice) { w.invoice = `INV-${db.n.inv++}`; w.invoiceDate = nowStr(); }
  back(wrPath(w.id), { ok: `Invoice ${w.invoice} created.` });
});
export const addPayment = act(async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  const amount = num(f, "amount");
  if (!Number.isFinite(amount) || amount <= 0) back(wrPath(w.id), { err: "Enter a payment amount more than 0." });
  if (amount > balance(w) + 0.001) back(wrPath(w.id), { err: `That's more than the balance of ${money(balance(w))}.` });
  const method = s(f, "method");
  if (!method || method.length > 30) back(wrPath(w.id), { err: "Choose how the customer paid (or type a new payment method)." });
  const paid = r2(amount);
  w.payments.push({ date: nowStr(), time: timeNow(), amount: paid, method, ref: s(f, "ref") });
  rememberName(db.payMethods, method);
  back(wrPath(w.id), { ok: `Payment of ${money(paid)} by ${method} added. ${balance(w) > 0 ? `Balance left: ${money(balance(w))}.` : "Paid in full."}` });
});
// Bound from the page: voidPayment.bind(null, receiptId, paymentIndex).
export const voidPayment = act(async (wr: string, i: number) => {
  const w = db.wrs.find((x) => x.id === wr);
  if (!w || !w.payments[i]) return;
  const [p] = w.payments.splice(i, 1);
  back(wrPath(w.id), { ok: `Payment of ${money(p.amount)} (${p.method}) voided.` });
});

// Scan a parcel on Consolidate: it is selected for consolidation, and if it was never received it is received right now.
export const scanForConsolidate = act(async (f: F) => {
  const tracking = cleanTracking(s(f, "tracking")), picks = s(f, "picks").split(",").filter(Boolean);
  const go = (q: Record<string, string>): never => back(CO, { ...(picks.length && { pick: picks.join(",") }), ...q });
  if (tracking.length < 6) go({ err: "That doesn't look like a tracking number. Scan it again." });
  let it = db.items.find((i) => i.tracking === tracking), added = false;
  if (!it) {
    const sess = await readSess();
    it = { id: db.n.item++, date: sess?.date ?? nowStr(), carrier: sess?.carrier ?? "UNKNOWN", tracking, receiver: sess?.receiver ?? (await cookies()).get("rcv_name")?.value ?? "Consolidate", batch: sess?.batch ?? "0" };
    db.items.push(it);
    added = true;
  } else if (it.piece) go({ err: `${tracking} already belongs to ${it.customer} (piece ${it.piece}).` });
  const id = String(it!.id);
  back(CO, { pick: (picks.includes(id) ? picks : [...picks, id]).join(","), ok: added ? `${tracking} was not in the system: it is received now. Fill in the customer below.` : `${tracking} selected. Fill in the customer below.` });
});

// ---------- Shipments and their booking info ----------
const shipPath = (name: string) => `/warehouse/shipments/${encodeURIComponent(name)}`;
const SH = "/warehouse/shipments";
const yn = (v: string): "YES" | "NO" => (v === "YES" ? "YES" : "NO");
export const createShipment = act(async (f: F) => {
  const name = s(f, "name").replace(/\s+/g, " ");
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,39}$/.test(name)) back(SH, { err: "Name the shipment with letters, numbers, spaces, dots, dashes or underscores (40 characters max), for example PL-AIR-10-06-2026." });
  if (db.shipments.some((x) => x.name.toLowerCase() === name.toLowerCase())) back(SH, { err: `${name} already exists.` });
  const sh = { name, ship: shipOf(s(f, "ship")), cargoId: String(db.n.cargo++), date: nowStr() };
  db.shipments.push(sh);
  openBooking(sh);
  back(shipPath(name), { ok: `Shipment ${name} created (Cargo ID ${sh.cargoId}).` });
});
export const saveBooking = act(async (f: F) => {
  const name = s(f, "shipment"), sh = db.shipments.find((x) => x.name === name);
  if (!sh) return;
  const b = openBooking(sh), here = shipPath(name);
  const blCost = num(f, "blCost") || 0, declared = num(f, "declared") || 0;
  const contents = [0, 1, 2].map((i) => ({ label: s(f, `cl_${i}`), value: num(f, `cv_${i}`) || 0 }));
  if ([blCost, declared, ...contents.map((c) => c.value)].some((v) => v < 0)) back(here, { err: "Amounts can't be negative." });
  const pallets: typeof b.pallets = {};
  cargoOf(name).pallets.forEach((_, i) => {
    const pn = s(f, `pn_${i}`);
    if (pn) pallets[pn] = { type: s(f, `pt_${i}`).toUpperCase() || "PALLET", l: Math.max(0, num(f, `pl_${i}`) || 0), w: Math.max(0, num(f, `pw_${i}`) || 0), h: Math.max(0, num(f, `ph_${i}`) || 0) };
  });
  const keys = ["line", "awb", "bol", "sailDate", "origin", "destination", "vessel", "freightPayableAt", "shipperName", "shipperAddress", "shipperCity", "shipperContact",
    "consigneeName", "consigneeAddress", "consigneeCity", "consigneeContact", "receiver", "notify", "notifyContact", "pieceType", "commodity",
    "containerSize", "spotDate", "spotTime", "containerId", "seal", "tag", "arrivalDate", "notes", "signer"] as const;
  for (const k of keys) b[k] = s(f, k);
  Object.assign(b, { blCost, declared, contents, pallets, sed: yn(s(f, "sed")), refrigeration: yn(s(f, "refrigeration")), hazmat: yn(s(f, "hazmat")) });
  back(here, { ok: "Booking saved." });
});

// ---------- Pallets / containers / cargo ----------
export const loadPiece = act(async (f: F) => {
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
});
export const unloadPiece = act(async (f: F) => {
  const l = db.loads.find((x) => x.no === num(f, "no"));
  if (l && !db.shipments.find((x) => x.name === l.shipment)?.shipped) db.loads = db.loads.filter((x) => x !== l);
  revalidatePath(PL);
});
export const shipCargo = act(async (f: F) => {
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
});

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
export const receiveHere = act(async (f: F) => {
  const raw = s(f, "code"), no = Number(raw.split("|").pop());
  const l = db.loads.find((x) => x.no === no);
  if (!l) back(AR, { err: `Piece "${raw}" was never loaded on a shipment. Check the label.` });
  if (!db.shipments.find((x) => x.name === l!.shipment)?.shipped) back(AR, { err: `Piece ${no} is on ${l!.shipment}, which hasn't shipped yet.` });
  if (l!.here) back(AR, { err: `Piece ${no} was already received here on ${l!.here}.` });
  l!.here = nowStr();
  const failed = await syncArrived([l!.wr]);
  back(AR, { ok: `Piece ${no} received.`, ...(failed && { warn: `${failed} parcel(s) could not be updated on the website.` }) });
});
export const arriveShipment = act(async (f: F) => {
  const name = s(f, "shipment");
  if (!db.shipments.find((x) => x.name === name)?.shipped) return;
  const touched = new Set<string>();
  db.loads.forEach((l) => { if (l.shipment === name && !l.here) { l.here = nowStr(); touched.add(l.wr); } });
  const failed = await syncArrived([...touched]);
  back(AR, { ok: `All pieces of ${name} are marked as here.`, ...(failed && { warn: `${failed} parcel(s) could not be updated on the website.` }) });
});
export const markHereNotified = act(async (f: F) => {
  // Email sending is not wired yet: this only records that the customer was told.
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (w) w.hereNotified = true;
  revalidatePath(AR);
});

// Website status 3 "ready for pickup".
export const markReady = act(async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  w.ready = true;
  let failed = 0;
  for (const i of db.items) if (i.wr === w.id && i.clientId && await pushStatus({ tracking: i.tracking, status: 3, clientId: i.clientId })) failed++;
  back(AR, { ok: `${wrCode(w)} is ready for pickup.`, ...(failed && { warn: `${failed} parcel(s) could not be updated on the website.` }) });
});
