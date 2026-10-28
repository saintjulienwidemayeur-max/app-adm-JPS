"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { actor } from "./actor";
import { waParcel, waNowReceipt, waNowStatus, waFailed, waSay } from "./whatsapp";
import { receiptPdf } from "./pdf";
import { db, siteUSA, findPiece, nowStr, balance, money, wrCode, r2, findCustomer, newCustomer, openWR, repOf, insuranceFee, openBooking, cargoOf, timeNow, creditOf, custOf, newOrderId, orderBalance, orderSubtotal, orderTotal, ORDER_FEE_PCT, ORDER_STATUSES, type Order, type OrderStatus, SLI_SERVICES, type Item, type Customer, effectiveShip, type Pickup, type PickupStatus, type Prealert, rateFor, DESTINATIONS, destOf, US_DEST, toUSA, shToUSA, freightFee, OCEAN_HANDLING, HANDLING_LABEL, wrSig, PICKUP_STATUSES, PICKUP_FEE, pickupFeeLine, remember as rememberName, type Ship, type WR, type Fee, type Shipment, charges, similarCustomers, priced } from "./wh-store";
import { syncEnabled, findClientId, pushStatus, sitePrealerts, markSitePrealertReceived, siteEstimate, markSiteEstimateAnswered, mailOne, mailTo, mailEnabled } from "./jps-sync";
import { adoptSitePrealert } from "./prealert-sync";
import { act } from "./act";
import { queueMail, queueReceiptSoon, emailReceipt, emailParcelArrived, emailHaiti, emailStatus, payLinkOf } from "./auto-mail";
import { isoToUs, usToIso } from "./clock";
import { trackingOk, cleanTrackingNo, HAZARD_FLAGS, reviewFlags, type HazardKey, type PrealertItem } from "./compliance";
import { nextDeparture } from "./schedule";
import { extractTracking, sameTracking } from "./tracking";
import { oldScanIndex } from "./cargo-import";
import { parseEstimate, estimate } from "./estimate";
import { usableEmail } from "./mailrules";

// Every action: make sure the database copy is loaded, run it, then save what changed (also when it ends with a redirect).


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
type Sess = { batch: string; date: string; carrier: string; receiver: string; office?: "Haiti" };
const readSess = async (): Promise<Sess | null> => { try { return JSON.parse((await cookies()).get("rcv")?.value ?? "null"); } catch { return null; } };
const cleanTracking = (v: string) => extractTracking(v);

export const startDelivery = act("startDelivery", async (f: F) => {
  const carrier = s(f, "carrier").toUpperCase(), receiver = s(f, "receiver") || actor();
  const d = new Date(s(f, "date") + "T00:00");
  if (!carrier || isNaN(d.getTime())) back(RX, { err: "Choose the date and the carrier." });
  rememberName(db.carriers, carrier);
  const jar = await cookies();
  jar.set("rcv", JSON.stringify({ batch: String(db.n.batch++), date: isoToUs(s(f, "date")), carrier, receiver, ...(s(f, "office") === "Haiti" && { office: "Haiti" }) }), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 16 });
  jar.set("rcv_name", receiver, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  back(RX);
});
export const endDelivery = act("endDelivery", async () => {
  const sess = await readSess();
  (await cookies()).delete("rcv");
  const n = sess ? db.items.filter((i) => i.batch === sess.batch).length : 0;
  back(RX, sess ? { ok: `Delivery closed: ${n} parcel${n === 1 ? "" : "s"} from ${sess.carrier}.` } : {});
});
// The customer of a parcel is known (announced, typed at the scan, or set later): tell the website. That creates the parcel on the customer's
// tracking page (status 0, "received in Miami") and the website sends the push notification and the e-mail "your parcel arrived at our office".
async function notifyReceived(item: Item, c: { name: string; email: string; clientId?: string; box?: string } | undefined, ship: Ship, mails?: Map<number, { c: Customer; t: string[] }>): Promise<string> {
  // Received at the Haiti office (going to the USA): the website only knows the Miami -> Haiti route, so the customer is told by our own e-mail.
  if (item.office === "Haiti" && !siteUSA()) {
    const full = c && "no" in c ? (c as Customer) : db.customers.find((x) => x.name === c?.name);
    if (full && usableEmail(full)) { if (mails) { const e = mails.get(full.no) ?? { c: full, t: [] }; e.t.push(item.tracking); mails.set(full.no, e); } else emailParcelArrived(full, [item.tracking], "Haiti"); }
    return "";
  }
  if (!syncEnabled()) return "";
  let clientId = item.clientId ?? c?.clientId;
  if (!clientId && c) {
    for (const who of [c.box, c.email, c.name]) { if (!who) continue; const r = await findClientId(who); if (r.id) { clientId = r.id; break; } }
  }
  if (!clientId) {
    // No account on the website: the e-mail on file (if there is a real one) gets "your parcel arrived" from here.
    const full = c && "no" in c ? (c as Customer) : db.customers.find((x) => x.name === c?.name);
    if (full && usableEmail(full)) { if (mails) { const e = mails.get(full.no) ?? { c: full, t: [] }; e.t.push(item.tracking); mails.set(full.no, e); } else emailParcelArrived(full, [item.tracking], item.office === "Haiti" ? "Haiti" : undefined); return ""; }
    return `${c?.name ?? "This customer"} has no account on the website and no usable e-mail: no tracking and no notification.`;
  }
  item.clientId = clientId;
  const usa = item.office === "Haiti", e = await pushStatus({ tracking: item.tracking, status: 0, clientId, type: ship, description: usa ? "Received at the Haiti office" : "Received at the Miami warehouse", ...(usa && { direction: "US" as const }) });
  return e ? `The website update failed: ${e}` : "";
}
// The customer field of Received items: "1001 · Name" (picked from the list), a number, a name or an e-mail.
const pickCustomer = (v: string) => { const n = v.match(/^\s*(\d+)\s*(·|$)/); return findCustomer(n ? n[1] : v); };
type Res = Record<string, string>;
// WhatsApp: one message per customer listing the parcels that were just saved (identified ones only).
function waForNew(fromId: number, office?: "Haiti") {
  const by = new Map<number, string[]>();
  for (const i of db.items) if (i.id >= fromId && i.customer) { const c = db.customers.find((x) => x.name === i.customer); if (c) (by.get(c.no) ?? by.set(c.no, []).get(c.no)!).push(i.tracking); }
  for (const [no, t] of by) waParcel(db.customers.find((x) => x.no === no), t, office === "Haiti");
}
// A parcel with no tracking number (a box somebody brings, no label to scan): the system makes one, JPS + 7 digits, written on the box with the label that is printed after saving.
const NOTRACK = "*NOTRACK*";
const nextNoTrack = () => `JPS${String(db.n.nt++).padStart(7, "0")}`;
// One scanned parcel: saves it and tells who it is for. Returns what the page shows (ok / info / warn / err). `mails`: collects the direct e-mails (customers with no website account) so a batch sends one e-mail per customer.
async function receiveOne(sess: Sess, raw: string, typed: string, mails?: Map<number, { c: Customer; t: string[] }>): Promise<Res> {
  const made = raw.startsWith(NOTRACK), tracking = made ? nextNoTrack() : cleanTracking(raw);
  if (tracking.length < 6) return { err: "That doesn't look like a tracking number. Scan it again." };
  const dup = made ? undefined : db.items.find((i) => sameTracking(i.tracking, tracking));
  if (dup) return { err: `DUPLICATE: ${tracking} was already accepted on ${dup.date} (${dup.carrier}, ${dup.receiver ? `received by ${dup.receiver}` : "no receiver noted"}). Not counted.` };
  const who = typed ? pickCustomer(typed) : undefined;
  if (typed && !who) return { err: `No customer matches "${typed}". Leave the field empty if you don't know it, or pick a customer from the list.` };
  // Already received in the old system? A warning only (a customer can order again, and tracking numbers get reused).
  const oldHit = db.oldWrs.length ? oldScanIndex(db.oldWrs).get(tracking.slice(-12))?.find((h) => true) : undefined;
  const oldMsg = oldHit ? ` Careful: this tracking number was already received in the old system on ${oldHit.date || "an unknown date"} (receipt ${oldHit.wr}).` : "";
  const item: Item = { id: db.n.item++, date: sess!.date, carrier: sess!.carrier, receiver: sess!.receiver, batch: sess!.batch, tracking, by: actor(), ...(made && { made: true }), ...(sess!.office && { office: sess!.office }) };
  db.items.push(item);
  // The scan is matched to what the customer announced: it already knows the customer and the shipping choice.
  let pa = made ? undefined : db.prealerts.find((x) => x.status === "Expected" && sameTracking(x.tracking, tracking));
  if (!pa && !made && syncEnabled()) {
    const r = await sitePrealerts(cleanTrackingNo(tracking)); // announced on the website but not imported yet
    if (r.rows[0]) pa = await adoptSitePrealert(r.rows[0]);
  }
  if (pa && pa.status === "Expected") {
    const ship = effectiveShip(pa);
    if (cleanTrackingNo(pa.tracking).length > item.tracking.length) item.tracking = cleanTrackingNo(pa.tracking); // the scanner read the tail of a long barcode: keep the number the customer announced
    Object.assign(item, { customer: pa.customer, ship, prealert: pa.id, clientId: pa.clientId });
    Object.assign(pa, { status: "Received", itemId: item.id });
    if (pa.siteId) await markSitePrealertReceived(pa.siteId);
    const c = db.customers.find((x) => x.no === pa!.cust);
    const warn = await notifyReceived(item, c ?? { name: pa.customer, email: "", clientId: pa.clientId }, ship, mails);
    return { ok: tracking, ...(made && { made: tracking }), info: `Matched: ${pa.customer} (customer ${pa.cust}) · ${pa.choice ? ship : "no answer yet, Air by default"}${pa.wait ? " · waiting for other orders" : ""}.${syncEnabled() && !warn ? " The customer was told by push and e-mail." : ""}${oldMsg}`, ...(warn && { warn }) };
  }
  if (who) {
    Object.assign(item, { customer: who.name, ship: "Air" as Ship, clientId: who.clientId });
    const warn = await notifyReceived(item, who, "Air", mails);
    return { ok: tracking, ...(made && { made: tracking }), info: `For ${who.name} (customer ${who.no}).${syncEnabled() && !warn ? " The customer was told by push and e-mail." : ""}${oldMsg}`, ...(warn && { warn }) };
  }
  return { ok: tracking, ...(made && { made: tracking }), warn: `Not announced by any customer: it waits in the review queue until it is identified.${oldMsg}` };
}
export const receiveItem = act("receiveItem", async (f: F) => {
  const sess = await readSess();
  if (!sess) back(RX, { err: "Start a delivery first." });
  const from = db.n.item;
  const res = await receiveOne(sess!, s(f, "tracking"), s(f, "customer"));
  waForNew(from, sess!.office);
  back(RX, res);
});
// Many parcels in one go: the person scans them all (for one customer, or none), then saves. One e-mail per customer lists all the parcels.
export const receiveBatch = act("receiveBatch", async (f: F) => {
  const sess = await readSess();
  if (!sess) back(RX, { err: "Start a delivery first." });
  const codes = [...new Set(s(f, "codes").split(/\r?\n/).map((x) => x.trim()).filter(Boolean))].slice(0, 300), typed = s(f, "customer");
  if (!codes.length) back(RX, { err: "Scan at least one parcel before you save." });
  if (typed && !pickCustomer(typed)) back(RX, { err: `No customer matches "${typed}". Nothing was saved.` });
  const mails = new Map<number, { c: Customer; t: string[] }>(), firstId = db.n.item;
  let ok = 0; const bad: string[] = [], warns: string[] = [], who = new Set<string>(), madeCodes: string[] = [];
  for (const code of codes) {
    const r = await receiveOne(sess!, code, typed, mails);
    if (r.err) { bad.push(`${code}: ${r.err.replace(/^DUPLICATE: /, "already received. ")}`); continue; }
    ok++; if (r.warn) warns.push(r.warn); if (r.made) madeCodes.push(r.made);
    const m = (r.info ?? "").match(/^(?:For|Matched:) ([^(·]+?)(?: \(|$| ·)/); if (m) who.add(m[1].trim());
  }
  for (const { c, t } of mails.values()) emailParcelArrived(c, t, sess!.office);
  waForNew(firstId, sess!.office);
  back(RX, { t: String(Date.now()), ...(madeCodes.length && { made: madeCodes.join(",") }), ...(ok && { info: `${ok} parcel${ok === 1 ? "" : "s"} saved${typed ? ` for ${pickCustomer(typed)!.name}` : who.size ? ` (${[...who].slice(0, 4).join(", ")}${who.size > 4 ? "..." : ""})` : ""}.` }), ...(bad.length && { err: `${bad.length} not saved: ${bad.slice(0, 5).join(" · ")}${bad.length > 5 ? " ..." : ""}` }), ...(warns.length && { warn: `${warns.length} parcel${warns.length === 1 ? "" : "s"} could not be matched to a customer or notified: they wait in the review queue.` }) });
});
export const updateItem = act("updateItem", async (f: F) => {
  const it = db.items.find((i) => i.id === num(f, "id")), tracking = cleanTracking(s(f, "tracking"));
  if (!it) return;
  if (tracking.length < 6) back(RX, { err: "The tracking number is too short." });
  if (db.items.some((i) => sameTracking(i.tracking, tracking) && i.id !== it.id)) back(RX, { err: `${tracking} already exists.` });
  it.tracking = tracking;
  it.carrier = s(f, "carrier").toUpperCase() || it.carrier;
  // Identifying the customer later (for a parcel that arrived unannounced) tells them and puts the parcel on their tracking page.
  // A wrong customer on a parcel that is not in a piece yet can be changed here too (the website tracking page follows the new customer).
  const typed = s(f, "customer");
  if (typed && (!it.customer || (!it.piece && !sameName(it.customer, pickCustomer(typed)?.name ?? "")))) {
    const who = pickCustomer(typed);
    if (!who) back(RX, { err: `No customer matches "${typed}".` });
    if (it.piece) back(RX, { err: `${tracking} is part of piece ${it.piece}. Delete that piece first, or move it to the right customer.` });
    const changed = !!it.customer;
    Object.assign(it, { customer: who!.name, ship: it.ship ?? "Air", clientId: changed ? who!.clientId : it.clientId ?? who!.clientId, prealert: changed ? undefined : it.prealert });
    const warn = await notifyReceived(it, who, it.ship ?? "Air");
    back(RX, { ok: tracking, info: `For ${who!.name} (customer ${who!.no}).${changed ? " The customer was changed." : ""}`, ...(warn && { warn }) });
  }
  back(RX, { ok: tracking });
});
export const deleteItem = act("deleteItem", async (f: F) => {
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
  const addToOpen = s(f, "receipt") === "open", dest = s(f, "dest") === US_DEST || (items.length > 0 && items.every((i) => i.office === "Haiti")) ? US_DEST : undefined; // "Miami": taken in Haiti, goes to the USA
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
  const like = !c && s(f, "newcust") !== "yes" ? similarCustomers(customer) : [];
  if (like.length) return back(CO, { err: `There is no customer "${customer}". Did you mean ${like.map((x) => `${x.name} (${x.no})`).join(" or ")}? Fix the name, or tick "New customer" to create "${customer}" as a different person.`, ...(items.length && { pick: items.map((i) => i.id).join(",") }) });
  const created = !c;
  if (!c) c = newCustomer(site.name ?? customer, { email: site.email ?? "" });
  else if (!c.email && site.email) c.email = site.email;
  // Every piece gets its own new warehouse receipt, unless staff chose to add it to the customer's open one
  // (same ship type, not invoiced, nothing loaded yet).
  const cno = c.no;
  let w = addToOpen ? db.wrs.find((x) => x.cust === cno && x.ship === ship && toUSA(x) === toUSA({ dest: dest ?? destOf(c) }) && !x.invoice && !x.pieces.some((pc) => db.loads.some((l) => l.no === pc.no))) : undefined;
  if (!w) w = openWR(c, ship, dest ? { dest } : {});
  const no = db.n.piece++;
  w.pieces.push({ no, ...p, by: actor(), old: false, rd: 0 });
  const usa = toUSA(w);
  for (const i of items) Object.assign(i, { customer: c.name, piece: no, wr: w.id, clientId, ship });
  // Website status 0 "received in Miami": the customer gets the push + e-mail now that we know who it belongs to.
  if (clientId && (!usa || siteUSA())) for (const i of items) {
    const e = await pushStatus({ tracking: i.tracking, status: 0, clientId, type: ship, description: `JP's ${no}`, ...(usa && { direction: "US" as const }) });
    if (e) warn = `Piece created, but the website update failed: ${e}`;
  }
  queueReceiptSoon(w.id); // the receipt goes to the customer by e-mail by itself (a few minutes after the last piece)
  const note = created ? ` New customer ${c.no}: add the phone and address on the Customers page.` : "";
  return back(CO, { ok: `Piece ${no} created for ${c.name} (customer ${c.no}, ${wrCode(w)}${addToOpen ? "" : ", new receipt"}) from ${items.length} parcel${items.length > 1 ? "s" : ""}.${note}`, wr: w.id, piece: String(no), ...(warn && { warn }) });
}
export const singlePiece = act("singlePiece", async (f: F) => { await assign([num(f, "id")], f); });
export const combinePieces = act("combinePieces", async (f: F) => { await assign(f.getAll("id").map(Number), f); });

// ---------- Warehouse receipts ----------
const emailOk = (e: string) => !e || /^\S+@\S+\.\S+$/.test(e);
export const createWR = act("createWR", async (f: F) => {
  const name = s(f, "customer");
  if (!name) back("/warehouse/receipts", { err: "Choose or enter the customer." });
  const like = !findCustomer(name) && s(f, "newcust") !== "yes" ? similarCustomers(name) : [];
  if (like.length) back("/warehouse/receipts", { err: `There is no customer "${name}". Did you mean ${like.map((x) => `${x.name} (${x.no})`).join(" or ")}? Fix the name, or tick "New customer" to create "${name}" as a different person.` });
  // The first boxes can be typed here too (same size and weight, Qty of them): checked BEFORE anything is created.
  const withBoxes = ["l", "w", "h", "lbs", "contents"].some((k) => s(f, k)), box = withBoxes ? pieceInput(f) : undefined, qty = Math.round(num(f, "qty") || 1);
  if (typeof box === "string") back("/warehouse/receipts", { err: `${box} (or leave the boxes empty to add them on the receipt page).` });
  if (withBoxes && (!Number.isFinite(qty) || qty < 1 || qty > 100)) back("/warehouse/receipts", { err: "Number of boxes: from 1 to 100." });
  const c = findCustomer(name) ?? newCustomer(name);
  const route = s(f, "route").toUpperCase();
  const w = openWR(c, shipOf(s(f, "ship")), { comments: s(f, "comments"), ...(route && { route }), ...(s(f, "dest") === US_DEST && { dest: US_DEST }) });
  if (box && typeof box !== "string") { for (let i = 0; i < qty; i++) w.pieces.push({ no: db.n.piece++, ...box, by: actor(), old: false, rd: 0 }); queueReceiptSoon(w.id); }
  back(wrPath(w.id), box && typeof box !== "string" ? { ok: `Receipt created with ${qty} box${qty === 1 ? "" : "es"}.` } : {});
});
// Changes the ship type of a receipt (JPF <-> JPL). Ocean gets its standard handling fee automatically; going back to Air removes it
// (only the automatic line: a fee staff edited stays) and the standard rate of the new method applies.
function applyShip(w: WR, ship: Ship): string {
  if (ship === w.ship) return "";
  if (w.pieces.some((p) => db.loads.some((l) => l.no === p.no))) return "Some pieces are already loaded on a shipment, so the ship type can't change.";
  if (w.invoice) return `Receipt ${wrCode(w)} is already invoiced (${w.invoice}): cancel the invoice first to change the ship type.`;
  db.items.forEach((i) => { if (i.wr === w.id) i.ship = ship; });
  w.ship = ship;
  w.rate = rateFor(custOf(w), ship, w.dest);
  if (ship === "Ocean") {
    // Ocean handling: a handling line typed by hand (for example the Air one) becomes the automatic Ocean line, at least $45.
    const own = w.fees.find((x) => x.kind === "charge" && x.label.trim().toLowerCase() === HANDLING_LABEL.toLowerCase());
    if (own) { own.auto = "handling"; own.amount = Math.max(own.amount, OCEAN_HANDLING); }
    else w.fees.push({ id: db.n.fee++, label: HANDLING_LABEL, amount: OCEAN_HANDLING, kind: "charge", auto: "handling" });
  }
  else w.fees = w.fees.filter((x) => x.auto !== "handling");
  return "";
}
export const switchShip = act("switchShip", async (wr: string) => {
  const w = db.wrs.find((x) => x.id === wr);
  if (!w) return;
  const to: Ship = w.ship === "Air" ? "Ocean" : "Air", bad = applyShip(w, to);
  if (bad) back(wrPath(w.id), { err: bad });
  back(wrPath(w.id), { ok: `Changed to ${to === "Ocean" ? "Ocean" : "Air"}: the receipt is now ${wrCode(w)}${to === "Ocean" ? ` and the ${money(OCEAN_HANDLING)} handling fee was added` : ""}.` });
});
// "Notify by e-mail" button: sends the e-mail now (the same ones that go out by themselves), even if it was already sent.
// "Notify": the e-mail (with the PDF for a receipt) and the WhatsApp message. `channel` sends only one of them (the "send again" buttons).
type NKind = "receipt" | "arrived" | "ready" | "shipped";
async function sendOne(w: WR, kind: NKind, channel: string): Promise<{ mailErr: string | null; waErr: string | null }> {
  let mailErr: string | null = null, waErr: string | null = null; // null = not tried
  if (channel !== "wa") mailErr = !mailEnabled() ? "e-mail is not set up on this server" : kind === "receipt" ? await emailReceipt(w, "sent by staff (button)", true) : await emailStatus(w, kind);
  if (channel !== "email") waErr = kind === "receipt" ? await waNowReceipt(w, wrSig(w), async () => ({ name: `Receipt-${wrCode(w)}.pdf`, bytes: await receiptPdf(w) }), payLinkOf(w)) : await waNowStatus(w, kind);
  return { mailErr, waErr };
}
const nk = (kind: string): NKind => (kind === "receipt" || kind === "shipped" || kind === "arrived" ? kind : "ready");
export const notifyEmail = act("notifyEmail", async (wr: string, kind: string, ret?: string, channel?: string) => {
  const w = db.wrs.find((x) => x.id === wr);
  const to = ret || (w ? wrPath(w.id) : "/warehouse/receipts");
  if (!w) return;
  const k = nk(kind), { mailErr, waErr } = await sendOne(w, k, channel ?? "both");
  const mFail = !!mailErr, wFail = waErr !== null && waFailed(waErr);
  const left = { ...(mFail && { nm: w.id }), ...(wFail && { nw: w.id }), ...((mFail || wFail) && { nkind: k }) };
  const parts = [mailErr !== null && (mailErr ? `E-mail NOT sent (${mailErr})` : "E-mail sent"), waErr !== null && waSay(waErr)].filter(Boolean).join(". ");
  const tried = [mailErr !== null, waErr !== null].filter(Boolean).length;
  if (tried && (mFail ? 1 : 0) + (wFail ? 1 : 0) === tried) back(to, { err: `Nothing was sent. ${parts.replace(/\.$/, "")}.`, ...left });
  back(to, { ok: `${parts.replace(/\.$/, "")}.`, ...left });
});
// Tells again, one channel only, the customers whose e-mail or WhatsApp message did not go.
export const notifyRetry = act("notifyRetry", async (kind: string, channel: string, ids: string, ret: string) => {
  const k = nk(kind), list = ids.split(",").filter(Boolean).slice(0, 300), nm: string[] = [], nw: string[] = [];
  let sent = 0;
  for (const id of list) {
    const w = db.wrs.find((x) => x.id === id); if (!w) continue;
    const { mailErr, waErr } = await sendOne(w, k, channel);
    if (mailErr) nm.push(id); else if (mailErr === "") sent++;
    if (waErr !== null && waFailed(waErr)) nw.push(id); else if (waErr !== null) sent++;
  }
  const left = { ...(nm.length && { nm: nm.join(",") }), ...(nw.length && { nw: nw.join(",") }), ...((nm.length || nw.length) && { nkind: k }) };
  back(ret || "/warehouse/receipts", { [nm.length || nw.length ? "err" : "ok"]: `${sent} ${channel === "email" ? "e-mail" : "WhatsApp"} message(s) sent${nm.length || nw.length ? `, ${nm.length + nw.length} still not sent` : ""}.`, ...left });
});
// Administrator only (it is not in the rights table of act()): a cargo shipped by mistake goes back to "open", so pieces can be unloaded, moved or added and the cargo shipped again.
// Refused once a piece was received at the destination. The customers' "in transit" e-mails and the website tracking cannot be taken back.
export const reopenShipment = act("reopenShipment", async (name: string) => {
  const sh = db.shipments.find((x) => x.name === name), to = `/warehouse/shipments/${encodeURIComponent(name)}`;
  if (!sh?.shipped) back(to, { err: "This shipment has not shipped." });
  if (db.loads.some((l) => l.shipment === name && l.here)) back(to, { err: "Some pieces were already received at the destination. On the arrivals page use \"Scanned a piece by mistake?\" for each of them first." });
  sh!.shipped = undefined; sh!.shippedBy = undefined;
  const ids = new Set(db.loads.filter((l) => l.shipment === name).map((l) => l.wr));
  db.items.forEach((i) => { if (i.wr && ids.has(i.wr)) i.shipped = false; });
  back(to, { ok: `${name} is open again: you can unload, move or add pieces, then ship it again. The customers who were told "in transit" keep that e-mail.` });
});
export const notifyShipmentEmail = act("notifyShipmentEmail", async (name: string) => {
  const to = `/warehouse/shipments/${encodeURIComponent(name)}`;
  if (!db.shipments.find((x) => x.name === name)?.shipped) back(to, { err: "This shipment has not left yet." });
  const ids = [...new Set(db.loads.filter((l) => l.shipment === name).map((l) => l.wr))];
  let mail = 0, wa = 0; const nm: string[] = [], nw: string[] = [];
  for (const id of ids) {
    const w = db.wrs.find((x) => x.id === id); if (!w) continue;
    const { mailErr, waErr } = await sendOne(w, "shipped", "both");
    if (mailErr) nm.push(id); else mail++;
    if (waErr !== null && waFailed(waErr)) nw.push(id); else wa++;
  }
  const left = { ...(nm.length && { nm: nm.join(",") }), ...(nw.length && { nw: nw.join(",") }), ...((nm.length || nw.length) && { nkind: "shipped" }) };
  if (!mail && !wa) back(to, { err: `Nothing was sent (${ids.length} receipt${ids.length === 1 ? "" : "s"}): e-mail is not set up or the customers have no usable address, and WhatsApp is off, not set up, or the customers have no number.`, ...left });
  back(to, { ok: `Notified: ${mail} e-mail(s) and ${wa} WhatsApp message(s) sent${nm.length || nw.length ? ` (${nm.length} e-mail and ${nw.length} WhatsApp could not be sent)` : ""}.`, ...left });
});

// Once a receipt has an invoice, what the invoice is made of cannot change by itself: cancel the invoice first (payments are not affected).
const invoiceLock = (w: WR, what: string) => (w.invoice ? `Receipt ${wrCode(w)} is already invoiced (${w.invoice}): cancel the invoice first to change ${what}.` : "");
export const updateWR = act("updateWR", async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  const declared = num(f, "declared") || 0;
  if (declared < 0) back(wrPath(w.id), { err: "Declared value can't be negative." });
  if (!emailOk(s(f, "email"))) back(wrPath(w.id), { err: "That email address isn't valid." });
  const ship = shipOf(s(f, "ship") || w.ship);
  const dest = DESTINATIONS.includes(s(f, "dest")) ? s(f, "dest") : (w.dest ?? destOf(custOf(w))), destChanged = dest !== (w.dest ?? destOf(custOf(w)));
  if (destChanged && w.invoice) back(wrPath(w.id), { err: `Receipt ${wrCode(w)} is already invoiced (${w.invoice}): cancel the invoice first to change the destination.` });
  // A new destination brings its rate, unless a different rate was typed on purpose.
  const rate = s(f, "rate") === "" || (destChanged && num(f, "rate") === r2(w.rate ?? 0)) ? rateFor(custOf(w), ship, dest) : num(f, "rate");
  if (!Number.isFinite(rate) || rate < 0 || rate > 1000) back(wrPath(w.id), { err: "Enter a rate of 0 or more." });
  if (destChanged && toUSA({ dest }) !== toUSA(w) && w.pieces.some((p) => db.loads.some((l) => l.no === p.no))) back(wrPath(w.id), { err: "Some pieces are already loaded on a shipment, so the direction (to Haiti / to Miami) can't change." });
  if (w.invoice) {
    const changed = r2(rate) !== r2(w.rate ?? 0) || declared !== w.declared || (s(f, "insurance") === "Accepted" ? "Accepted" : "Declined") !== w.insurance || (s(f, "estimate") === "yes") !== !!w.estimate;
    if (changed) back(wrPath(w.id), { err: invoiceLock(w, "the rate, the value, the insurance or the estimate mark") });
  }
  const bad = applyShip(w, ship);
  if (bad) back(wrPath(w.id), { err: bad });
  Object.assign(w, {
    declared, dest, rate: r2(rate), rep: repOf(s(f, "rep")) ? s(f, "rep") : "", insurance: s(f, "insurance") === "Accepted" ? "Accepted" : "Declined",
    kind: s(f, "shipKind") === "Commercial" ? "Commercial" : "Personal", shipperName: s(f, "shipperName").slice(0, 80), shipperPhone: s(f, "shipperPhone").slice(0, 40), receiverName: s(f, "receiverName").slice(0, 80), receiverPhone: s(f, "receiverPhone").slice(0, 40), receiverAddress: s(f, "receiverAddress").slice(0, 160),
    estimate: s(f, "estimate") === "yes", comments: s(f, "comments"), route: s(f, "route").toUpperCase(), email: s(f, "email"),
  });
  back(wrPath(w.id), { ok: "Receipt saved." });
});

// ---------- Fees and credits on a receipt ----------
const feeKind = (v: string): Fee["kind"] => (v === "credit" ? "credit" : "charge");
const feeSum = (fees: Fee[], k: Fee["kind"]) => fees.filter((x) => x.kind === k).reduce((a, x) => a + x.amount, 0);
const tooMuchCredit = (w: WR, fees: Fee[]) => r2(freightFee(w) + feeSum(fees, "charge") + insuranceFee(w) - feeSum(fees, "credit")) < 0;
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
export const addFee = act("addFee", async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  if (w.invoice) back(wrPath(w.id), { err: invoiceLock(w, "its fees") });
  const label = s(f, "label"), amount = num(f, "amount"), kind = feeKind(s(f, "kind"));
  const bad = feeProblem(label, amount);
  if (bad) back(wrPath(w.id), { err: bad });
  if (kind === "charge" && (w.rate ?? 0) > 0 && /^freight/i.test(label)) back(wrPath(w.id), { err: "Freight charges are added automatically from the weight (or cubic feet) and the rate. Change the rate in Receipt details." });
  const fee: Fee = { id: db.n.fee++, label, amount: r2(amount), kind };
  if (tooMuchCredit(w, [...w.fees, fee])) back(wrPath(w.id), { err: "That credit is more than the charges on this receipt." });
  w.fees.push(fee);
  remember(kind, label);
  back(wrPath(w.id), { ok: `${kind === "credit" ? "Credit" : "Fee"} "${label}" added.` });
});
export const saveFees = act("saveFees", async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  if (w.invoice) back(wrPath(w.id), { err: invoiceLock(w, "its fees") });
  const next: Fee[] = [];
  for (const fee of w.fees) {
    const label = s(f, `label_${fee.id}`), amount = num(f, `amount_${fee.id}`), kind = feeKind(s(f, `kind_${fee.id}`));
    const bad = feeProblem(label, amount);
    if (bad) back(wrPath(w.id), { err: `${fee.label}: ${bad}` });
    next.push({ id: fee.id, label, amount: r2(amount), kind, ...(fee.auto && kind === "charge" && { auto: fee.auto }) }); // the automatic handling line stays automatic (Ocean -> Air removes it)
  }
  if (tooMuchCredit(w, next)) back(wrPath(w.id), { err: "Credits can't be more than the charges on this receipt." });
  w.fees = next;
  next.forEach((x) => remember(x.kind, x.label));
  back(wrPath(w.id), { ok: "Fees saved." });
});
// Bound from the page as deleteFee.bind(null, receiptId, feeId): a submit button with a function formAction can't carry a name/value.
export const deleteFee = act("deleteFee", async (wr: string, fee: number) => {
  const w = db.wrs.find((x) => x.id === wr);
  if (!w) return;
  if (w.invoice) back(wrPath(w.id), { err: invoiceLock(w, "its fees") });
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
export const createCustomer = act("createCustomer", async (f: F) => {
  const d = custFields(f);
  if (!d.name) back(CU, { err: "Enter the customer's full name." });
  if (!emailOk(d.email)) back(CU, { err: "That email address isn't valid." });
  const dup = db.customers.find((x) => sameName(x.name, d.name));
  if (dup) back(`${CU}/${dup.no}`, { err: `${dup.name} already exists (customer ${dup.no}).` });
  const c = newCustomer(d.name, d);
  back(`${CU}/${c.no}`, { ok: `Customer ${c.no} created.` });
});
export const saveCustomer = act("saveCustomer", async (f: F) => {
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

// The customer's own rates (from the old system, or typed here). Empty = the standard rate.
export const saveCustomerRates = act("saveCustomerRates", async (f: F) => {
  const c = db.customers.find((x) => x.no === num(f, "no"));
  if (!c) return;
  const here = `${CU}/${c.no}`, rates: NonNullable<typeof c.rates> = {};
  for (const k of ["ocean", "air", "capa", "capo", "sdq", "droc"] as const) {
    const raw = s(f, `r_${k}`);
    if (!raw) continue;
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0 || v > 1000) back(here, { err: "A rate must be more than 0 (or empty)." });
    rates[k] = r2(v);
  }
  c.rates = Object.keys(rates).length ? rates : undefined;
  back(here, { ok: "Rates saved. They apply to the next receipts and estimates of this customer." });
});

// ---------- Representatives ----------
const RP = "/warehouse/reps";
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((x) => x[0]).join("").slice(0, 3).toUpperCase();
const repInput = (f: F) => { const name = s(f, "name"); return { name, initials: (s(f, "initials") || initialsOf(name)).toUpperCase().slice(0, 4) }; };
export const addRep = act("addRep", async (f: F) => {
  const { name, initials } = repInput(f);
  if (!name) back(RP, { err: "Enter the representative's name." });
  if (!initials) back(RP, { err: "Enter the initials." });
  if (db.reps.some((r) => r.initials === initials)) back(RP, { err: `The initials ${initials} are already used by another representative.` });
  db.reps.push({ id: String(db.n.rep++), name, initials });
  back(RP, { ok: `${name} (${initials}) added.` });
});
export const saveRep = act("saveRep", async (f: F) => {
  const r = db.reps.find((x) => x.id === s(f, "id"));
  if (!r) return;
  const { name, initials } = repInput(f);
  if (!name || !initials) back(RP, { err: "Enter the name and the initials." });
  if (db.reps.some((x) => x !== r && x.initials === initials)) back(RP, { err: `The initials ${initials} are already used by another representative.` });
  Object.assign(r, { name, initials });
  back(RP, { ok: `${name} saved.` });
});
export const deleteRep = act("deleteRep", async (f: F) => {
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
  const contents = s(f, "contents");
  if (!contents) return "Enter what is inside this piece (declared contents).";
  if (contents.length > 120) return "The contents are too long (120 characters max).";
  return { type: s(f, "type").toUpperCase() || "BOX - OTHER", l, w, h, lbs, contents, old: false, rd: 0 };
}
// A piece can't be added, changed or deleted once the receipt is invoiced: the invoice amount would change by itself.
const invoicedPieces = (w: WR) => `Receipt ${wrCode(w)} is already invoiced (${w.invoice}): cancel the invoice first to change its pieces.`;
export const addPiece = act("addPiece", async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  if (w.invoice) back(wrPath(w.id), { err: invoicedPieces(w) });
  const p = pieceInput(f), qty = Math.round(num(f, "qty") || 1);
  if (typeof p === "string") back(wrPath(w.id), { err: p });
  else if (!Number.isFinite(qty) || qty < 1 || qty > 100) back(wrPath(w.id), { err: "Number of boxes: from 1 to 100." });
  else if (w.pieces.length + qty > 500) back(wrPath(w.id), { err: "A receipt can't have more than 500 pieces." });
  else { for (let i = 0; i < qty; i++) w.pieces.push({ no: db.n.piece++, ...p, by: actor(), old: false }); queueReceiptSoon(w.id); }
  back(wrPath(w.id), qty > 1 ? { ok: `${qty} boxes added (each one is its own piece with its own label).` } : {});
});
export const updatePiece = act("updatePiece", async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr")), no = num(f, "no");
  const piece = w?.pieces.find((x) => x.no === no);
  if (!w || !piece) return;
  if (w.invoice) back(wrPath(w.id), { err: invoicedPieces(w) });
  if (db.loads.some((l) => l.no === no)) back(wrPath(w.id), { err: `Piece ${no} is already loaded. Remove it from the pallet first.` });
  const p = pieceInput(f);
  if (typeof p === "string") back(wrPath(w.id), { err: p });
  else Object.assign(piece, { ...p, old: piece.old });
  back(wrPath(w.id), { ok: `Piece ${no} updated. If its label was already printed, print it again: the label shows the weight and the size.`, label: String(no) });
});
export const deletePiece = act("deletePiece", async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr")), no = num(f, "no");
  if (!w) return;
  if (w.invoice) back(wrPath(w.id), { err: invoicedPieces(w) });
  if (db.loads.some((l) => l.no === no)) back(wrPath(w.id), { err: `Piece ${no} is already loaded. Remove it from the pallet first.` });
  db.items.forEach((i) => { if (i.piece === no) Object.assign(i, { piece: undefined, wr: undefined, customer: undefined, clientId: undefined }); });
  w.pieces = w.pieces.filter((x) => x.no !== no);
  back(wrPath(w.id), { ok: `Piece ${no} deleted.` });
});
// Wrong customer on a piece: moves it to the open receipt of the right customer (same ship type), or to a new one.
export const movePiece = act("movePiece", async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr")), no = num(f, "no");
  const piece = w?.pieces.find((x) => x.no === no);
  if (!w || !piece) return;
  if (w.invoice) back(wrPath(w.id), { err: invoicedPieces(w) });
  if (db.loads.some((l) => l.no === no)) back(wrPath(w.id), { err: `Piece ${no} is already loaded. Remove it from the pallet first.` });
  const typed = s(f, "customer"), c = findCustomer(typed);
  if (!c) back(wrPath(w.id), { err: `No customer matches "${typed}". Type the name or the number of an existing customer.` });
  if (c!.no === w.cust) back(wrPath(w.id), { err: `Piece ${no} already belongs to ${c!.name}.` });
  const to = db.wrs.find((x) => x.cust === c!.no && x.ship === w.ship && !x.invoice && !x.pieces.some((pc) => db.loads.some((l) => l.no === pc.no))) ?? openWR(c!, w.ship);
  w.pieces = w.pieces.filter((x) => x !== piece);
  to.pieces.push(piece);
  db.items.forEach((i) => { if (i.piece === no) Object.assign(i, { customer: c!.name, wr: to.id, clientId: c!.clientId }); });
  queueReceiptSoon(to.id);
  back(wrPath(w.id), { ok: `Piece ${no} moved to ${c!.name} (customer ${c!.no}, ${wrCode(to)}). Print its label again: the label carries the receipt and the customer number.` });
});
export const createInvoice = act("createInvoice", async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  if (w.estimate) back(wrPath(w.id), { err: 'This receipt is marked as an estimate. Untick "estimate" in the details when the real weights are in, then invoice it.' });
  if (!w.pieces.length && charges(w) <= 0) back(wrPath(w.id), { err: "Add at least one piece or one fee before invoicing." });
  if (!w.invoice) { for (const p of w.pieces) { p.old ??= false; p.rd ??= 0; } /* this invoice is made with today's formulas: never switch it to the old ones */ w.invoice = `INV-${db.n.inv++}`; w.invoiceDate = nowStr(); }
  back(wrPath(w.id), { ok: `Invoice ${w.invoice} created.` });
});
export const addPayment = act("addPayment", async (f: F) => {
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
export const voidPayment = act("voidPayment", async (wr: string, i: number) => {
  const w = db.wrs.find((x) => x.id === wr);
  if (!w || !w.payments[i]) return;
  const [p] = w.payments.splice(i, 1);
  const c = custOf(w);
  if (p.method === "Customer credit" && c) (c.creditLog ??= []).push({ date: nowStr(), time: timeNow(), amount: p.amount, note: `Returned: payment on ${wrCode(w)} voided` });
  back(wrPath(w.id), { ok: `Payment of ${money(p.amount)} (${p.method}) voided.` });
});

// ---------- Billing: customer payments, credit, invoice follow-up ----------
const PY = "/warehouse/payments";
// A payment from a customer is spread over their receipts with a balance, oldest first; what is left stays as the customer's credit.
export const receivePayment = act("receivePayment", async (f: F) => {
  const c = db.customers.find((x) => x.no === num(f, "cust"));
  if (!c) back(PY, { err: "Choose the customer." });
  const here = `${PY}?c=${c!.no}`, amount = num(f, "amount"), method = s(f, "method"), ref = s(f, "ref");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) back(here, { err: "Enter the amount received (more than 0)." });
  if (!method || method.length > 30) back(here, { err: "Choose how the customer paid (or type a new payment method)." });
  const batch = `PAY-${db.n.pay++}`, date = nowStr(), time = timeNow();
  let left = r2(amount);
  const open = db.wrs.filter((w) => w.cust === c!.no && priced(w) && balance(w) > 0)
    .sort((a, b) => usToIso(a.date).localeCompare(usToIso(b.date)) || Number(a.id) - Number(b.id));
  for (const w of open) {
    const take = Math.min(left, balance(w));
    if (take <= 0) break;
    w.payments.push({ date, time, amount: r2(take), method, ref, batch });
    left = r2(left - take);
  }
  if (left > 0) (c!.creditLog ??= []).push({ date, time, amount: left, note: `Paid more than owed (${method})`, batch, method, ref });
  rememberName(db.payMethods, method);
  back(`${PY}/${batch}`);
});
export const applyCredit = act("applyCredit", async (wr: string) => {
  const w = db.wrs.find((x) => x.id === wr), c = w && custOf(w);
  if (!w || !c) return;
  const take = Math.min(creditOf(c), balance(w));
  if (take <= 0) back(wrPath(w.id), { err: "The customer has no credit, or this receipt has no balance." });
  w.payments.push({ date: nowStr(), time: timeNow(), amount: r2(take), method: "Customer credit", ref: "" });
  (c.creditLog ??= []).push({ date: nowStr(), time: timeNow(), amount: -r2(take), note: `Applied to ${wrCode(w)}` });
  back(wrPath(w.id), { ok: `${money(take)} of the customer's credit applied.` });
});
export const markInvoiceSent = act("markInvoiceSent", async (wr: string) => {
  const w = db.wrs.find((x) => x.id === wr);
  if (w?.invoice) { w.invoiceSent = nowStr(); back(`/warehouse/invoices/${w.invoice}`, { ok: "Marked as emailed." }); }
});
export const cancelInvoice = act("cancelInvoice", async (wr: string) => {
  const w = db.wrs.find((x) => x.id === wr);
  if (!w?.invoice) return;
  if (w.payments.length) back(`/warehouse/invoices/${w.invoice}`, { err: "This invoice has payments. Void them first." });
  const no = w.invoice;
  w.invoice = undefined; w.invoiceDate = undefined; w.invoiceSent = undefined;
  back(wrPath(w.id), { ok: `Invoice ${no} cancelled.` });
});

// ---------- Purchase orders ----------
const OR = "/warehouse/orders";
const orderPath = (id: string) => `${OR}/${id}`;
const itemInput = (desc: string, qty: number, unit: number) => {
  if (!desc) return "Enter what is being bought.";
  if (desc.length > 120) return "The description is too long (120 characters max).";
  if (!Number.isFinite(qty) || qty <= 0 || qty > 10000) return "Enter a quantity (more than 0).";
  if (!Number.isFinite(unit) || unit < 0 || unit > 1_000_000) return "Enter the unit cost (0 or more).";
  return "";
};
export const createOrder = act("createOrder", async (f: F) => {
  const name = s(f, "customer");
  if (!name) back(OR, { err: "Choose or enter the customer." });
  const c = findCustomer(name) ?? newCustomer(name);
  const o: Order = { id: newOrderId(), date: nowStr(), cust: c.no, customer: c.name, rep: c.rep, items: [], feePct: ORDER_FEE_PCT, notes: "", status: "Invoiced", tracking: "", payments: [] };
  db.orders.unshift(o);
  back(orderPath(o.id));
});
export const saveOrder = act("saveOrder", async (f: F) => {
  const o = db.orders.find((x) => x.id === s(f, "order"));
  if (!o) return;
  const pct = num(f, "feePct");
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) back(orderPath(o.id), { err: "The purchasing fee must be between 0 and 100 %." });
  const status = s(f, "status") as OrderStatus;
  Object.assign(o, { feePct: pct, notes: s(f, "notes"), tracking: s(f, "tracking"), rep: repOf(s(f, "rep")) ? s(f, "rep") : "", status: ORDER_STATUSES.includes(status) ? status : o.status });
  back(orderPath(o.id), { ok: "Order saved." });
});
export const addOrderItem = act("addOrderItem", async (f: F) => {
  const o = db.orders.find((x) => x.id === s(f, "order"));
  if (!o) return;
  const desc = s(f, "desc"), qty = num(f, "qty"), unit = num(f, "unit"), bad = itemInput(desc, qty, unit);
  if (bad) back(orderPath(o.id), { err: bad });
  o.items.push({ desc, qty, unit: r2(unit) });
  back(orderPath(o.id), { ok: `"${desc}" added.` });
});
export const saveOrderItems = act("saveOrderItems", async (f: F) => {
  const o = db.orders.find((x) => x.id === s(f, "order"));
  if (!o) return;
  const next = [];
  for (let i = 0; i < o.items.length; i++) {
    const desc = s(f, `d_${i}`), qty = num(f, `q_${i}`), unit = num(f, `u_${i}`), bad = itemInput(desc, qty, unit);
    if (bad) back(orderPath(o.id), { err: `Line ${i + 1}: ${bad}` });
    next.push({ desc, qty, unit: r2(unit) });
  }
  o.items = next;
  back(orderPath(o.id), { ok: "Lines saved." });
});
// Bound from the page: deleteOrderItem.bind(null, orderId, lineIndex).
export const deleteOrderItem = act("deleteOrderItem", async (id: string, i: number) => {
  const o = db.orders.find((x) => x.id === id);
  if (!o) return;
  o.items.splice(i, 1);
  back(orderPath(o.id), { ok: "Line removed." });
});
export const addOrderPayment = act("addOrderPayment", async (f: F) => {
  const o = db.orders.find((x) => x.id === s(f, "order"));
  if (!o) return;
  const amount = num(f, "amount"), method = s(f, "method");
  if (!Number.isFinite(amount) || amount <= 0) back(orderPath(o.id), { err: "Enter a payment amount more than 0." });
  if (amount > orderBalance(o) + 0.001) back(orderPath(o.id), { err: `That's more than the balance of ${money(orderBalance(o))}.` });
  if (!method || method.length > 30) back(orderPath(o.id), { err: "Choose how the customer paid (or type a new payment method)." });
  o.payments.push({ date: nowStr(), time: timeNow(), amount: r2(amount), method, ref: s(f, "ref") });
  rememberName(db.payMethods, method);
  if (orderBalance(o) <= 0 && o.status === "Invoiced") o.status = "Paid";
  back(orderPath(o.id), { ok: `Payment of ${money(r2(amount))} by ${method} added. ${orderBalance(o) > 0 ? `Balance left: ${money(orderBalance(o))}.` : "Paid in full: JP's can buy the order."}` });
});
export const voidOrderPayment = act("voidOrderPayment", async (id: string, i: number) => {
  const o = db.orders.find((x) => x.id === id);
  if (!o || !o.payments[i]) return;
  const [p] = o.payments.splice(i, 1);
  if (orderBalance(o) > 0 && o.status === "Paid") o.status = "Invoiced";
  back(orderPath(o.id), { ok: `Payment of ${money(p.amount)} (${p.method}) voided.` });
});

// Scan a parcel on Consolidate: it is selected for consolidation, and if it was never received it is received right now.
export const scanForConsolidate = act("scanForConsolidate", async (f: F) => {
  const tracking = cleanTracking(s(f, "tracking")), picks = s(f, "picks").split(",").filter(Boolean);
  const go = (q: Record<string, string>): never => back(CO, { ...(picks.length && { pick: picks.join(",") }), ...q });
  if (tracking.length < 6) go({ err: "That doesn't look like a tracking number. Scan it again." });
  let it = db.items.find((i) => sameTracking(i.tracking, tracking)), added = false;
  if (!it) {
    const sess = await readSess();
    it = { id: db.n.item++, date: sess?.date ?? nowStr(), carrier: sess?.carrier ?? "UNKNOWN", tracking, receiver: sess?.receiver ?? (await cookies()).get("rcv_name")?.value ?? "", batch: sess?.batch ?? "0" };
    db.items.push(it);
    added = true;
  } else if (it.piece) go({ err: `${tracking} already belongs to ${it.customer} (piece ${it.piece}).` });
  const id = String(it!.id);
  back(CO, { pick: (picks.includes(id) ? picks : [...picks, id]).join(","), ok: added ? `${tracking} was not in the system: it is received now. Fill in the customer below.` : `${tracking} selected. Fill in the customer below.` });
});

// ---------- Pickups: collect the parcel at the customer's address ----------
// The price is a "Pickup fee" line on the customer's warehouse receipt, so it is already there when the invoice is made.
const PK = "/warehouse/pickups";
const pickupPath = (id: string) => `${PK}/${id}`;
const isoOk = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + "T00:00").getTime());
// Puts the price on the receipt (adds, changes or removes the fee line). Returns a message when it can't.
function syncPickupFee(p: Pickup, price: number): string {
  const w = db.wrs.find((x) => x.id === p.wr);
  if (!w) return "The receipt of this pickup no longer exists.";
  const line = pickupFeeLine(p);
  if (w.invoice && r2(line?.amount ?? 0) !== r2(price)) return `Receipt ${wrCode(w)} is already invoiced (${w.invoice}): cancel the invoice first to change the pickup fee.`;
  if (price > 0) {
    if (line) line.amount = r2(price);
    else { const fee: Fee = { id: db.n.fee++, label: PICKUP_FEE, amount: r2(price), kind: "charge" }; w.fees.push(fee); p.feeId = fee.id; }
  } else if (line) {
    const next = w.fees.filter((x) => x.id !== line.id);
    if (tooMuchCredit(w, next)) return "Remove the credit on the receipt first: it would be more than the remaining charges.";
    w.fees = next; p.feeId = undefined;
  }
  p.price = r2(price);
  return "";
}
const priceOf = (f: F) => { const v = s(f, "price"); return v === "" ? 0 : num(f, "price"); };
const pickupProblem = (f: F, price: number) => {
  if (!s(f, "address")) return "Enter the pickup address.";
  if (!isoOk(s(f, "date"))) return "Choose the pickup date.";
  if (!Number.isFinite(price) || price < 0 || price > 100000) return "Enter a pickup price of 0 or more.";
  return "";
};
export const createPickup = act("createPickup", async (f: F) => {
  const name = s(f, "customer");
  if (!name) back(PK, { err: "Choose or enter the customer." });
  const price = priceOf(f), bad = pickupProblem(f, price);
  if (bad) back(PK, { err: bad });
  const c = findCustomer(name) ?? newCustomer(name);
  const ship = shipOf(s(f, "ship"));
  // The fee goes on the customer's open receipt (same ship type, not invoiced, nothing loaded yet), or on a new one.
  const w = db.wrs.find((x) => x.cust === c.no && x.ship === ship && !x.invoice && !x.pieces.some((pc) => db.loads.some((l) => l.no === pc.no))) ?? openWR(c, ship);
  const p: Pickup = {
    id: `PU-${String(db.n.pickup++).padStart(4, "0")}`, created: nowStr(), cust: c.no, customer: c.name,
    contact: s(f, "contact") || c.name, phone: s(f, "phone") || c.phone, address: s(f, "address"), city: s(f, "city"),
    date: s(f, "date"), time: s(f, "time"), what: s(f, "what"), notes: s(f, "notes"), driver: s(f, "driver"), price: 0, wr: w.id, status: "Scheduled",
  };
  const err = syncPickupFee(p, price);
  if (err) back(PK, { err });
  db.pickups.unshift(p);
  back(pickupPath(p.id), { ok: `Pickup ${p.id} scheduled.${price > 0 ? ` ${money(price)} added to receipt ${wrCode(w)}.` : ""}` });
});
export const savePickup = act("savePickup", async (f: F) => {
  const p = db.pickups.find((x) => x.id === s(f, "pickup"));
  if (!p) return;
  const price = priceOf(f), bad = pickupProblem(f, price);
  if (bad) back(pickupPath(p.id), { err: bad });
  if (p.status !== "Cancelled") { const err = syncPickupFee(p, price); if (err) back(pickupPath(p.id), { err }); } else p.price = r2(price);
  Object.assign(p, {
    contact: s(f, "contact"), phone: s(f, "phone"), address: s(f, "address"), city: s(f, "city"), date: s(f, "date"), time: s(f, "time"),
    what: s(f, "what"), notes: s(f, "notes"), driver: s(f, "driver"),
  });
  back(pickupPath(p.id), { ok: "Pickup saved." });
});
// Bound from the page as setPickupStatus.bind(null, id, status).
export const setPickupStatus = act("setPickupStatus", async (id: string, status: string) => {
  const p = db.pickups.find((x) => x.id === id);
  if (!p || !PICKUP_STATUSES.includes(status as PickupStatus) || p.status === status) return;
  if (status === "Cancelled") {
    const keep = p.price;
    const err = syncPickupFee(p, 0);
    if (err) back(pickupPath(p.id), { err });
    p.price = keep; // remembered, in case the pickup is scheduled again
  } else if (p.status === "Cancelled") {
    const err = syncPickupFee(p, p.price);
    if (err) back(pickupPath(p.id), { err });
  }
  p.status = status as PickupStatus;
  back(pickupPath(p.id), { ok: `Pickup ${status === "Picked up" ? "marked as picked up" : status === "Cancelled" ? "cancelled (the fee was removed from the receipt)" : "scheduled again"}.` });
});

// ---------- Pre-alerts: the customer announces an online order before it arrives ----------
const PA = "/warehouse/prealerts";
const paPath = (id: string) => `${PA}/${id}`;
const hazardsOf = (f: F): HazardKey[] => f.getAll("hz").map(String).filter((v): v is HazardKey => HAZARD_FLAGS.some(([k]) => k === v));
export const savePrealert = act("savePrealert", async (f: F) => {
  const pa = db.prealerts.find((x) => x.id === s(f, "id"));
  if (!pa) return;
  const choice = s(f, "choice") === "Air" || s(f, "choice") === "Ocean" ? (s(f, "choice") as Ship) : undefined;
  Object.assign(pa, { choice, wait: s(f, "wait") === "yes", notes: s(f, "notes"), invoiceRef: s(f, "invoiceRef") });
  const it = db.items.find((i) => i.id === pa.itemId);
  if (it && !it.piece) it.ship = effectiveShip(pa);
  back(paPath(pa.id), { ok: "Saved." });
});
export const cancelPrealert = act("cancelPrealert", async (id: string) => {
  const pa = db.prealerts.find((x) => x.id === id);
  if (!pa || pa.status !== "Expected") return;
  pa.status = "Cancelled";
  back(PA, { ok: `${pa.id} cancelled.` });
});

// ---------- Estimate -> warehouse receipt ----------
export const estimateToReceipt = act("estimateToReceipt", async (f: F) => {
  const query: Record<string, string> = {};
  f.forEach((v, k) => { if (k !== "ship" && String(v).trim()) query[k] = String(v); });
  const fail = (err: string): never => back("/warehouse/estimate", { ...query, err });
  const inp = parseEstimate((k) => s(f, k) || undefined), ship = shipOf(s(f, "ship"));
  if (!inp.customer) fail("Enter the customer to make a receipt.");
  if (!inp.rows.length) fail("Enter at least one box.");
  if (inp.rows.some((r) => !r.contents)) fail("Enter the contents of every box (it is required on the receipt).");
  if (inp.rows.reduce((a, r) => a + r.qty, 0) > 200) fail("That is more than 200 boxes. Split it in several receipts.");
  const est = estimate(inp), opt = ship === "Ocean" ? est.ocean : est.air;
  const charge = opt.lines.filter((l) => l.kind !== "credit").reduce((a, l) => a + l.amount, 0);
  if (inp.credit > charge) fail("The credit is more than the charges.");
  const c = findCustomer(inp.customer) ?? newCustomer(inp.customer);
  const w = openWR(c, ship, { estimate: true, ...(DESTINATIONS.includes(s(f, "dest")) && { dest: s(f, "dest") }), rate: opt.rate, declared: inp.declared, insurance: inp.insure && inp.declared > 0 ? "Accepted" : "Declined" });
  for (const r of inp.rows) for (let k = 0; k < r.qty; k++) w.pieces.push({ no: db.n.piece++, type: "BOX - OTHER", l: r.l, w: r.w, h: r.h, lbs: r.lbs, contents: r.contents, by: actor(), old: false, rd: 0 });
  // Handling: Ocean already got its automatic line; use the amount of the estimate. Air gets one only when the estimate has it.
  const handling = ship === "Ocean" ? inp.handlingOcean : inp.handlingAir;
  const auto = w.fees.find((x) => x.auto === "handling");
  if (auto) { if (handling > 0) auto.amount = r2(handling); else w.fees = w.fees.filter((x) => x !== auto); }
  else if (handling > 0) w.fees.push({ id: db.n.fee++, label: HANDLING_LABEL, amount: r2(handling), kind: "charge" });
  const add = (label: string, amount: number, kind: Fee["kind"] = "charge") => { if (amount > 0) w.fees.push({ id: db.n.fee++, label, amount: r2(amount), kind }); };
  add(PICKUP_FEE, inp.pickup); add("Repacking and consolidation", inp.repack); add(inp.otherLabel || "Other", inp.other); add("Discount", inp.credit, "credit");
  back(wrPath(w.id), { ok: `Receipt ${wrCode(w)} created from the estimate: ${w.pieces.length} piece${w.pieces.length === 1 ? "" : "s"}, estimated total ${money(opt.total)}. Add the customer's phone and details if needed.` });
});

// ---------- Shipments and their booking info ----------
const shipPath = (name: string) => `/warehouse/shipments/${encodeURIComponent(name)}`;
const SH = "/warehouse/shipments";
const yn = (v: string): "YES" | "NO" => (v === "YES" ? "YES" : "NO");
export const createShipment = act("createShipment", async (f: F) => {
  const name = s(f, "name").replace(/\s+/g, " ");
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,39}$/.test(name)) back(SH, { err: "Name the shipment with letters, numbers, spaces, dots, dashes or underscores (40 characters max), for example PL-AIR-10-06-2026." });
  if (db.shipments.some((x) => x.name.toLowerCase() === name.toLowerCase())) back(SH, { err: `${name} already exists.` });
  const sh: Shipment = { name, ship: shipOf(s(f, "ship")), cargoId: String(db.n.cargo++), date: nowStr(), ...(s(f, "dir") === "USA" && { dir: "USA" as const }) };
  db.shipments.push(sh);
  openBooking(sh);
  back(shipPath(name), { ok: `Shipment ${name} created (Cargo ID ${sh.cargoId}).` });
});
export const saveBooking = act("saveBooking", async (f: F) => {
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
  for (const k of ["shipperAccount", "shipperEmail", "consigneeAccount", "consigneeEmail", "airportDep", "airportArr", "payment", "emergencyName", "emergencyPhone", "special"] as const) b[k] = s(f, k);
  const insureAmount = num(f, "insureAmount") || 0;
  if (insureAmount < 0) back(here, { err: "Amounts can't be negative." });
  const yesNo = (v: string) => (v === "Yes" || v === "No" ? v : "");
  Object.assign(b, { services: f.getAll("services").map(String).filter((v) => SLI_SERVICES.includes(v)), insure: yesNo(s(f, "insure")), insureAmount, hasQuote: yesNo(s(f, "hasQuote")), commercialInvoice: yn(s(f, "commercialInvoice")), pharma: yn(s(f, "pharma")) });
  Object.assign(b, { blCost, declared, contents, pallets, sed: yn(s(f, "sed")), refrigeration: yn(s(f, "refrigeration")), hazmat: yn(s(f, "hazmat")) });
  back(here, { ok: "Booking saved." });
});

// ---------- Pallets / containers / cargo ----------
export const loadPiece = act("loadPiece", async (f: F) => {
  const shipment = s(f, "shipment"), pallet = s(f, "pallet"), ship = shipOf(s(f, "ship"));
  const q = { shipment, pallet, ship };
  const no = Number(s(f, "code").split("|").pop());
  const hit = findPiece(no);
  if (!shipment || !pallet) back(PL, { ...q, err: "Enter the shipment and the pallet or container." });
  if (!hit) back(PL, { ...q, err: `Piece "${s(f, "code")}" not found. Scan the piece label.` });
  if (db.loads.some((l) => l.no === no)) back(PL, { ...q, err: `Piece ${no} is already loaded.` });
  let sh = db.shipments.find((x) => x.name === shipment);
  // A shipment is made on its own page, or by the first piece on the suggested name of the day. Any other unknown name is a typo (it would open a second shipment).
  if (!sh && db.shipments.some((x) => !x.shipped && x.ship === ship) && !/^(PL-AIR|CT-OCEAN)-\d\d-\d\d-\d{4}$/.test(shipment)) back(PL, { ...q, err: `There is no shipment named "${shipment}". Open shipments: ${db.shipments.filter((x) => !x.shipped && x.ship === ship).map((x) => x.name).join(", ")}. Pick one from the list, or create a new one on the Shipments page.` });
  if (!sh) { sh = { name: shipment, ship, cargoId: String(db.n.cargo++), date: nowStr(), ...(toUSA(hit!.w) && { dir: "USA" as const }) }; db.shipments.push(sh); }
  if (sh.shipped) back(PL, { ...q, err: `${shipment} was already shipped.` });
  if (hit!.w.ship !== sh.ship) back(PL, { ...q, ship: sh.ship, err: `Piece ${no} is ${hit!.w.ship} but ${shipment} is ${sh.ship}.` });
  if (toUSA(hit!.w) !== shToUSA(sh)) back(PL, { ...q, ship: sh.ship, err: `Piece ${no} goes ${toUSA(hit!.w) ? "to Miami" : "to Haiti"} but ${shipment} goes ${shToUSA(sh) ? "Haiti -> Miami" : "Miami -> Haiti"}. Use a ${toUSA(hit!.w) ? "Haiti -> Miami" : "Miami -> Haiti"} shipment.` });
  db.loads.push({ shipment, pallet, wr: hit!.w.id, no, date: nowStr(), by: actor() });
  back(PL, { ...q, ship: sh.ship, ok: String(no) });
});
export const unloadPiece = act("unloadPiece", async (f: F) => {
  const l = db.loads.find((x) => x.no === num(f, "no"));
  if (l && !db.shipments.find((x) => x.name === l.shipment)?.shipped) db.loads = db.loads.filter((x) => x !== l);
  revalidatePath(PL);
});
export const shipCargo = act("shipCargo", async (f: F) => {
  const sh = db.shipments.find((x) => x.name === s(f, "shipment"));
  const q = { shipment: s(f, "shipment"), pallet: s(f, "pallet"), ship: s(f, "ship") };
  if (!sh || sh.shipped) return;
  const loads = db.loads.filter((l) => l.shipment === sh.name);
  if (!loads.length) back(PL, { ...q, err: "Load at least one piece before shipping." });
  sh.shipped = nowStr(); sh.shippedBy = actor();
  const wrIds = new Set(loads.map((l) => l.wr));
  const mine = db.items.filter((i) => i.wr && wrIds.has(i.wr));
  mine.forEach((i) => { i.shipped = true; });
  // Tracking website: status 1 "in transit / customs" for every linked parcel of these receipts.
  let failed = 0;
  if (!shToUSA(sh) || siteUSA()) for (const i of mine) if (i.clientId && await pushStatus({ tracking: i.tracking, status: 1, clientId: i.clientId, ...(shToUSA(sh) && { direction: "US" as const }) })) failed++; // Haiti -> Miami only when the website knows that direction
  // E-mails by themselves: the receipt (PDF) to every customer of this shipment, and "in transit" to the customers with no website account.
  for (const id of wrIds) { const w = db.wrs.find((x) => x.id === id); if (!w) continue; queueMail(() => emailReceipt(w, `shipment ${sh.name} shipped`)); emailHaiti(w, "shipped"); }
  back(PL, { ...q, ok: `${sh.name} shipped (Cargo ID ${sh.cargoId}).`, ...(failed && { warn: `${failed} parcel(s) could not be updated on the website.` }) });
});

// ---------- Arrivals in Pétion-Ville (cargo from Miami) and in Miami (cargo from Haiti) ----------
const AR = "/warehouse/arrivals", ARM = "/warehouse/arrivals-miami";
const arPath = (usa: boolean) => (usa ? ARM : AR);
// Website status 2 "arrived in Haiti" once EVERY piece of a receipt is here (a partial arrival changes nothing). Cargo that arrives in Miami
// is not on the website's route: those customers get our own e-mail instead.
async function syncArrived(wrIds: string[]) {
  let failed = 0;
  for (const id of wrIds) {
    const w = db.wrs.find((x) => x.id === id);
    if (!w || !w.pieces.length || !w.pieces.every((p) => db.loads.some((l) => l.no === p.no && l.here))) continue;
    if (!toUSA(w) || siteUSA()) for (const i of db.items) if (i.wr === id && i.clientId && await pushStatus({ tracking: i.tracking, status: 2, clientId: i.clientId, ...(toUSA(w) && { direction: "US" as const }) })) failed++;
    emailHaiti(w, "arrived"); // customers with no website account (the others get the website's push + e-mail), and always for cargo arriving in Miami
    if (syncEnabled() || mailEnabled()) w.hereNotified = true; // the customer is told by itself: nothing to press
  }
  return failed;
}
export const receiveHere = act("receiveHere", async (f: F) => {
  const raw = s(f, "code"), no = Number(raw.split("|").pop()), page = arPath(s(f, "dir") === "USA");
  const l = db.loads.find((x) => x.no === no);
  if (!l) back(page, { err: `Piece "${raw}" was never loaded on a shipment. Check the label.` });
  const sh = db.shipments.find((x) => x.name === l!.shipment), usa = shToUSA(sh);
  if (usa !== (page === ARM)) back(page, { err: `Piece ${no} is on ${l!.shipment}, which goes ${usa ? "Haiti -> Miami: scan it on Arrivals Miami" : "Miami -> Haiti: scan it on Arrivals PV"}.` });
  if (!sh?.shipped) back(page, { err: `Piece ${no} is on ${l!.shipment}, which hasn't shipped yet.` });
  if (l!.here) back(page, { err: `Piece ${no} was already received here on ${l!.here}.` });
  l!.here = nowStr(); l!.hereBy = actor();
  const failed = await syncArrived([l!.wr]);
  back(page, { ok: `Piece ${no} received.`, ...(failed && { warn: `${failed} parcel(s) could not be updated on the website.` }) });
});
// A piece scanned here by mistake: takes it back to "expected" (only while the receipt is not marked ready for pickup).
export const undoReceiveHere = act("undoReceiveHere", async (f: F) => {
  const no = Number(s(f, "code").split("|").pop()), l = db.loads.find((x) => x.no === no && x.here);
  if (!l) back(arPath(s(f, "dir") === "USA"), { err: `Piece "${s(f, "code")}" is not marked as received here.` });
  const w = db.wrs.find((x) => x.id === l!.wr);
  if (w?.ready) back(arPath(w ? toUSA(w) : false), { err: `${wrCode(w)} is already marked ready for pickup: the customer was told.` });
  l!.here = undefined; l!.hereBy = undefined;
  back(arPath(w ? toUSA(w) : false), { ok: `Piece ${no} is back in the expected list.`, ...(w?.hereNotified && { warn: "The customer was already told that everything arrived; they are not told again." }) });
});
export const arriveShipment = act("arriveShipment", async (f: F) => {
  const name = s(f, "shipment"), sh = db.shipments.find((x) => x.name === name);
  if (!sh?.shipped) return;
  const touched = new Set<string>();
  db.loads.forEach((l) => { if (l.shipment === name && !l.here) { l.here = nowStr(); l.hereBy = actor(); touched.add(l.wr); } });
  const failed = await syncArrived([...touched]);
  back(arPath(shToUSA(sh)), { ok: `All pieces of ${name} are marked as here.`, ...(failed && { warn: `${failed} parcel(s) could not be updated on the website.` }) });
});
export const markHereNotified = act("markHereNotified", async (f: F) => {
  // Email sending is not wired yet: this only records that the customer was told.
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (w) w.hereNotified = true;
  revalidatePath(AR); revalidatePath(ARM);
});

// Website status 3 "ready for pickup" (Haiti), or the e-mail "ready for pickup in Miami" for cargo that came from Haiti.
export const markReady = act("markReady", async (f: F) => {
  const w = db.wrs.find((x) => x.id === s(f, "wr"));
  if (!w) return;
  w.ready = true;
  let failed = 0;
  if (!toUSA(w) || siteUSA()) for (const i of db.items) if (i.wr === w.id && i.clientId && await pushStatus({ tracking: i.tracking, status: 3, clientId: i.clientId, ...(toUSA(w) && { direction: "US" as const }) })) failed++;
  emailHaiti(w, "ready");
  back(arPath(toUSA(w)), { ok: `${wrCode(w)} is ready for pickup.`, ...(failed && { warn: `${failed} parcel(s) could not be updated on the website.` }) });
});

// ---------- Estimate requests from the website ----------
const ES = "/warehouse/estimate";
export const dismissEstimateRequest = act("dismissEstimateRequest", async (f: F) => {
  const e = await markSiteEstimateAnswered(s(f, "req"));
  back(ES, e ? { err: e } : { ok: "Request marked as answered." });
});
// The estimate as an e-mail (the website adds "Hello <full name>," before it and the team signature after it): Air and Ocean, line by line.
type EstResult = ReturnType<typeof estimate>;
function estimateMessage(est: EstResult, lang: "fr" | "en" | "es"): { subject: string; message: string } {
  const T = {
    fr: { s: "Votre estimation de JP's Logistics & More", intro: "Voici l'estimation pour vos colis :", air: "PAR AVION", sea: "PAR BATEAU", note: "Ceci est une estimation : le montant final figure sur votre reçu d'entrepôt, d'après le poids et la taille réels de vos colis.", q: "Des questions ? Répondez simplement à ce message ou écrivez-nous sur WhatsApp." },
    en: { s: "Your estimate from JP's Logistics & More", intro: "Here is the estimate for your boxes:", air: "BY AIR", sea: "BY SEA", note: "This is an estimate: the final amount is on your warehouse receipt, from the real weight and size of your parcels.", q: "Questions? Just reply to this message or write to us on WhatsApp." },
    es: { s: "Su estimación de JP's Logistics & More", intro: "Esta es la estimación de sus cajas:", air: "POR AVIÓN", sea: "POR BARCO", note: "Esto es una estimación: el monto final aparece en su recibo de almacén, según el peso y el tamaño reales de sus paquetes.", q: "¿Preguntas? Responda a este mensaje o escríbanos por WhatsApp." },
  }[lang];
  const lines = [T.intro, ""];
  for (const o of [est.air, est.ocean]) {
    lines.push(`**${o.ship === "Air" ? T.air : T.sea} : ${money(o.total)}**`);
    for (const l of o.lines) lines.push(`• ${l.kind === "credit" ? "-" : ""}${money(l.amount)} · ${l.label}${l.detail ? ` (${l.detail})` : ""}`);
    lines.push("");
  }
  lines.push(T.note, "", T.q);
  return { subject: T.s, message: lines.join("\n") };
}
const langOfC = (c: { lang?: string } | undefined): "fr" | "en" | "es" => (c?.lang === "en" || c?.lang === "es" ? c.lang : "fr");

// Answers a request: the priced estimate (Air and Ocean) goes to the customer by e-mail through the website.
export const emailEstimate = act("emailEstimate", async (f: F) => {
  const req = s(f, "req");
  const keep: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k !== "req" && typeof v === "string" && !k.startsWith("$")) keep[k] = v;
  const here = (extra: Record<string, string>) => back(ES, { ...keep, req, ...extra });
  if (!mailEnabled()) here({ err: "E-mail is not set up (Administration > Email customers shows what is missing)." });
  const r = await siteEstimate(req);
  if (!r) here({ err: "That request was not found on the website." });
  const inp = parseEstimate((k) => keep[k]);
  if (!inp.rows.length) here({ err: "Enter the boxes first." });
  const est = estimate(inp), known = r!.clients?.name ? findCustomer(r!.clients.name) : undefined;
  const m = estimateMessage(est, langOfC(known));
  const e = await mailOne(r!.client_id, m.subject, m.message);
  if (e) here({ err: `Not sent: ${e}` });
  await markSiteEstimateAnswered(req);
  back(ES, { ok: `Estimate sent to ${r!.clients?.name ?? "the customer"} and the request is marked as answered.` });
});
// An estimate made here (no website request): e-mailed to the customer typed above (or to any e-mail address typed in the box), by the customer's full name.
export const emailEstimateTo = act("emailEstimateTo", async (f: F) => {
  const keep: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k !== "to" && typeof v === "string" && !k.startsWith("$")) keep[k] = v;
  const here = (extra: Record<string, string>) => back(ES, { ...keep, ...extra });
  if (!mailEnabled()) here({ err: "E-mail is not set up (Administration > Email customers shows what is missing)." });
  const inp = parseEstimate((k) => keep[k]);
  if (!inp.rows.length) here({ err: "Enter the boxes first." });
  const c = keep.customer ? findCustomer(keep.customer) : undefined, typed = s(f, "to").toLowerCase();
  const to = typed || (c ? usableEmail(c) ?? "" : "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) here({ err: "Type the customer's e-mail address (this customer has no usable e-mail on file)." });
  const m = estimateMessage(estimate(inp), langOfC(c)), name = c?.name ?? keep.customer ?? "";
  // A customer with a website account and no other address typed: through the account; else to the address.
  const err = c?.clientId && !typed ? await mailOne(c.clientId, m.subject, m.message) : await mailTo({ email: to, name, lang: langOfC(c) }, m.subject, m.message);
  db.maillog.unshift({ id: db.n.mail++, date: nowStr(), time: timeNow(), by: "staff", subject: m.subject, to, sent: err ? 0 : 1, total: 1, failed: err ? [err] : [] });
  db.maillog.length = Math.min(db.maillog.length, 200);
  here(err ? { err: `Not sent: ${err}` } : { ok: `Estimate e-mailed to ${name || to} (${to}).` });
});
