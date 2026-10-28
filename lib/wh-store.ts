// In-memory warehouse data (frontend mode). Resets when the dev server restarts.
import { calcInsurance } from "./pricing";
import type { PrealertItem, HazardKey } from "./compliance";
import { usToday, isoToday, timeNow } from "./clock";
export { timeNow };
import { COMPANY, HAITI, ORIGIN, DESTINATION, AIRLINE, COMPANY_EMAILS, BLOCKED_EMAILS } from "./company";

export type Ship = "Air" | "Ocean";
// Set by lib/actor.ts: the name of the person doing the current action.
export const actorRef: { get: () => string } = { get: () => "" };
// `office`: "Haiti" when the parcel was received at the Haiti office (to be sent to the USA); absent = the Miami warehouse.
export type Item = { id: number; date: string; carrier: string; tracking: string; receiver: string; batch: string; customer?: string; piece?: number; ship?: Ship; shipped?: boolean; wr?: string; clientId?: string; prealert?: string; made?: boolean; by?: string; office?: "Haiti" };
// `by`: who made the piece. `old`: made before the 132 / 1788 formulas (measured with 139 / 1728), kept so that old invoices do not change.
export type Piece = { no: number; type: string; l: number; w: number; h: number; lbs: number; contents?: string; by?: string; old?: boolean; rd?: number };
export type Payment = { date: string; time?: string; amount: number; method: string; ref: string; batch?: string; online?: boolean; payer?: string; payerEmail?: string };
// Money a customer paid beyond what they owed (positive) and credit used later (negative).
export type CreditEntry = { date: string; time: string; amount: number; note: string; batch?: string; method?: string; ref?: string };
export type Rep = { id: string; name: string; initials: string };
// A customer ("Bill To"). `no` is the customer number printed on every label (1001, 1002, ...).
// The consignee is the person who receives the cargo in the destination country; blank fields mean "same as the customer".
export type Customer = {
  no: number; name: string; phone: string; email: string; billing: string;
  consignee: string; consigneePhone: string; consigneeAddress: string; consigneeCity: string; consigneeCountry: string;
  rep: string; route: string; creditLog?: CreditEntry[];
  // Set when the customer created an account on the website (same Supabase database): the website client id, the box number, the language.
  clientId?: string; box?: string; lang?: string;
  // From the old system (customer import): other contact details, this customer's own rates (per lb by Air, per cubic foot by Ocean, and the
  // other routes), whether an ID is on file, the old rep code.
  whatsapp?: string; waOff?: boolean; altPhone?: string; emailMore?: string; idOnFile?: boolean; legacyRep?: string; since?: string;
  rates?: CustomerRates;
  // The invitation to the website (account + temporary password by e-mail): when, how many times, and how it went.
  invite?: { at: string; time: string; count: number; status: "sent" | "failed"; error?: string };
};
export type CustomerRates = { ocean?: number; air?: number; capa?: number; capo?: number; sdq?: number; droc?: number };
// One line of "Fees and credits" on a receipt. Credits are subtracted from the total.
export type Fee = { id: number; label: string; amount: number; kind: "charge" | "credit"; auto?: "handling" | "storage" };
// A notice sent to the customer about a receipt (email or WhatsApp). `sig` is the state of the receipt that was sent.
export type Notice = { date: string; time: string; channel: "Email" | "WhatsApp"; sig: string; auto?: boolean; to?: string; doc?: string; why?: string };
export type WR = {
  id: string; date: string; customer: string; cust: number; email: string; route: string; rep: string; ship: Ship;
  comments: string; contents: string; declared: number; insurance: "Declined" | "Accepted";
  fees: Fee[]; invoice?: string; invoiceDate?: string; invoiceSent?: string; invoiceMail?: { error?: string; tries: number; at?: string }; hereNotified?: boolean; ready?: boolean; rate?: number; dest?: string; by?: string; waSig?: string; siteSig?: string; siteUrl?: boolean; payKey?: string; siteInv?: string; kind?: "Personal" | "Commercial"; shipperName?: string; shipperPhone?: string; receiverName?: string; receiverPhone?: string; estimate?: boolean; receiverAddress?: string; notices?: Notice[]; payments: Payment[]; pieces: Piece[];
};
// A purchase order: the customer pays JP's, and JP's buys the items and brings them to the Miami warehouse.
export type OrderItem = { desc: string; qty: number; unit: number };
export type OrderStatus = "Invoiced" | "Paid" | "Purchased" | "In Miami" | "Closed";
export const ORDER_STATUSES: OrderStatus[] = ["Invoiced", "Paid", "Purchased", "In Miami", "Closed"];
export type Order = {
  id: string; date: string; cust: number; customer: string; rep: string; items: OrderItem[]; feePct: number; notes: string;
  status: OrderStatus; tracking: string; payments: Payment[];
};
// A pickup: JP's driver goes to the customer's address to collect the parcel. The pickup price is a "Pickup fee" line on the
// customer's warehouse receipt (`wr`, `feeId`), so it is already there when the invoice is made.
export type PickupStatus = "Scheduled" | "Picked up" | "Cancelled";
export const PICKUP_STATUSES: PickupStatus[] = ["Scheduled", "Picked up", "Cancelled"];
export const PICKUP_FEE = "Pickup fee";
export type Pickup = {
  id: string; created: string; cust: number; customer: string; contact: string; phone: string; address: string; city: string;
  date: string; time: string; what: string; notes: string; driver: string; price: number; wr: string; feeId?: number; status: PickupStatus;
};
// What a customer tells JP's about an online order BEFORE it arrives: the carrier's final tracking number, what is inside and what it is worth,
// signed electronically. A scan of that tracking number matches the parcel to this record; a parcel nobody announced waits in the review queue.
export type PrealertStatus = "Expected" | "Received" | "Cancelled";
export type Prealert = {
  id: string; created: string; cust: number; customer: string; carrier: string; tracking: string; vendor: string;
  items: PrealertItem[]; invoiceRef: string; hazards: HazardKey[]; consigneeName: string; consigneePhone: string;
  choice?: Ship; wait: boolean; signedBy: string; signedAt: string; notes: string; status: PrealertStatus; itemId?: number;
  siteId?: string; clientId?: string; // set when the customer announced it on the website
};
export type Load = { shipment: string; pallet: string; wr: string; no: number; date: string; here?: string; by?: string; hereBy?: string };
// `dir`: "USA" = goes from Haiti to Miami (absent = Miami to Haiti, as before).
export type Shipment = { name: string; ship: Ship; cargoId: string; date: string; shipped?: string; shippedBy?: string; dir?: "USA" };

// Booking info of a shipment (the old "Shipment Booking Info" form). It feeds the Bill of Lading,
// the Shipper's Letter of Instruction and the cargo list.
export type PalletInfo = { type: string; l: number; w: number; h: number };
export type ContentLine = { label: string; value: number };
export type Booking = {
  shipment: string; line: string; awb: string; bol: string; sailDate: string; origin: string; destination: string; vessel: string;
  blCost: number; freightPayableAt: string; declared: number;
  shipperName: string; shipperAddress: string; shipperCity: string; shipperContact: string;
  consigneeName: string; consigneeAddress: string; consigneeCity: string; consigneeContact: string;
  receiver: string; notify: string; notifyContact: string;
  pieceType: string; commodity: string; sed: "YES" | "NO"; refrigeration: "YES" | "NO"; hazmat: "YES" | "NO";
  containerSize: string; spotDate: string; spotTime: string; containerId: string; seal: string; tag: string; arrivalDate: string;
  notes: string; signer: string; contents: ContentLine[]; pallets: Record<string, PalletInfo>;
  // Shipper's Letter of Instruction (Form SLI, revision 09/09/2024). Optional: bookings saved before these existed have none of them.
  shipperAccount?: string; shipperEmail?: string; consigneeAccount?: string; consigneeEmail?: string; airportDep?: string; airportArr?: string;
  services?: string[]; payment?: string; insure?: "Yes" | "No" | ""; insureAmount?: number; hasQuote?: "Yes" | "No" | "";
  emergencyName?: string; emergencyPhone?: string; commercialInvoice?: "YES" | "NO"; pharma?: "YES" | "NO"; special?: string;
};
export const SLI_SERVICES = ["Rush Expedited (PRI)/MIA Only", "Express Air Service (EXP)", "Regular Air Service (GEN)", "Loose Freight", "Palletized", "Small Package Service (SPS)", "E-Container", "D-Container", "Round Cardboard Container", "To Door Delivery"];
export const SLI_PAYMENTS = ["On Account", "Credit Card", "Pay Cargo / Cargo Sprint", "Collect (Pre-Approved Accounts Only)"];

export const FEE_PRESETS = [
  "Freight charges", "Handling fees", "Packaging material E-container", "Packaging material EH-container",
  "Import Conatel fees", "DG paperwork", "Pickup fee", "Repacking and consolidation", "Storage fee", "TCA",
];
export const CREDIT_PRESETS = ["Credit", "Discount", "Auth Discount", "Credit memo"];
export const PAY_METHODS = ["Zelle", "Credit Card", "CashApp", "Cash", "Check", "Wire", "WISE", "Virement", "MonCash", "Voucher", "Credit Memo", "Auth Discount", "Depot", "NO CHARGE", "Other"];
export const CARRIERS = ["AMAZON", "FEDEX", "UPS", "DHL", "USPS", "GOFO", "ONTRAC", "LASERSHIP", "UNIUNI", "SHEIN", "TEMU", "WALMART", "TARGET", "BEST BUY", "EBAY", "HOME DEPOT", "COSTCO", "DRIVER", "OTHER"];
export const COUNTRIES = ["Haiti", "Dominican Republic", "United States", "Jamaica", "Bahamas", "Turks and Caicos", "Cuba", "Canada"];
// Standard rates per method (editable per receipt): Air is billed per lb (the larger of gross and volumetric weight), Ocean per cubic foot.
export const AIR_RATE = 4.5, OCEAN_RATE = 16, OCEAN_HANDLING = 45, HANDLING_LABEL = "Handling fees";
export const defaultRate = (ship: Ship) => (ship === "Ocean" ? OCEAN_RATE : AIR_RATE);
// Where a parcel goes: every destination has its own rates (Administration > Fees & rates). "Miami": parcels JP's takes in Haiti to send to Miami.
export const DESTINATIONS = ["Port-au-Prince", "Cap Haitien", "Miragoane", "Cayes", "St Marc", "Hinche", "Jeremie", "Saint Domingue", "Miami"];
export const DEFAULT_DEST = "Port-au-Prince";
export const destLabel = (d: string) => (d === "Miami" ? "Miami (from Haiti)" : d);
// Direction: a receipt whose destination is Miami was taken in Haiti and goes to the USA; a shipment made for those receipts has dir "USA".
// Everything else (and every record saved before this existed) goes from Miami to Haiti.
export const US_DEST = "Miami";
// The website knows the Haiti -> Miami direction (its SQL section 16 is done and the new function and page are deployed): turned on in Fees & rates.
export const siteUSA = () => db.settings.siteDirection === true;
export const toUSA = (w: { dest?: string }) => w.dest === US_DEST;
export const shToUSA = (sh: { dir?: string } | undefined) => sh?.dir === "USA";
const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const ALIASES: Record<string, string> = { pap: "Port-au-Prince", portauprince: "Port-au-Prince", capehaitien: "Cap Haitien", caphaitien: "Cap Haitien", cap: "Cap Haitien", lescayes: "Cayes", cayes: "Cayes", stmarc: "St Marc", saintmarc: "St Marc", jeremie: "Jeremie", santodomingo: "Saint Domingue", saintdomingue: "Saint Domingue", stdomingue: "Saint Domingue", miragoane: "Miragoane", hinche: "Hinche", miami: "Miami", miamifl: "Miami", miamiflorida: "Miami" };
// The destination a customer's consignee city points to (the usual one when it is not recognised).
export const destOf = (c: { consigneeCity?: string } | undefined) => ALIASES[norm(c?.consigneeCity ?? "")] ?? DEFAULT_DEST;
export const destRate = (dest: string | undefined, ship: Ship) => { const r = db.settings.rates?.[dest ?? ""]?.[ship === "Ocean" ? "ocean" : "air"]; return r && r > 0 ? r : defaultRate(ship); };
// The rate of this customer (from the old system or typed on the customer page), else the rate of the destination, else the standard one.
// A customer's own rate for a destination that has its own price list in the old system (Cap-Air, Cap-Ocean, SDQ, DR Ocean) comes first.
const routeRate = (c: { rates?: CustomerRates } | undefined, ship: Ship, dest?: string) => {
  const r = c?.rates;
  return dest === "Cap Haitien" ? (ship === "Ocean" ? r?.capo : r?.capa) : dest === "Saint Domingue" ? (ship === "Ocean" ? r?.droc : r?.sdq) : undefined;
};
export const rateFor = (c: { rates?: CustomerRates } | undefined, ship: Ship, dest?: string) => {
  const own = routeRate(c, ship, dest), r = ship === "Ocean" ? c?.rates?.ocean : c?.rates?.air;
  return own && own > 0 ? own : r && r > 0 ? r : destRate(dest, ship);
};

// Settings the administrator can change (Administration > Fees & rates).
// Storage: the terms say a storage fee applies after 30 days in the warehouse. storageFee is the fee for each 30 days beyond the free period, per receipt
// (0 = no automatic storage fee).
export type Settings = { storageFreeDays: number; storageFee: number; siteDirection?: boolean; wa?: { on: boolean; cc?: string; events?: Partial<Record<"parcel" | "receipt" | "shipped" | "arrived" | "ready" | "invoice" | "order", boolean>> }; rates: Record<string, { air: number; ocean: number }> };
export const DEFAULT_SETTINGS: Settings = { storageFreeDays: 30, storageFee: 10, rates: Object.fromEntries(DESTINATIONS.map((d) => [d, { air: AIR_RATE, ocean: OCEAN_RATE }])) };
const today = () => usToday();
type WhDb = {
  items: Item[]; wrs: WR[]; loads: Load[]; shipments: Shipment[]; bookings: Booking[]; orders: Order[]; pickups: Pickup[]; prealerts: Prealert[]; users: User[]; maillog: MailLog[]; audit: AuditEntry[]; oldInvoices: OldInvoice[]; oldWrs: OldWR[]; oldShips: OldShip[]; blockedEmails: string[]; customers: Customer[]; reps: Rep[];
  feeNames: { charge: string[]; credit: string[] }; payMethods: string[]; carriers: string[]; settings: Settings;
  n: { wr: number; piece: number; item: number; cargo: number; inv: number; batch: number; cust: number; rep: number; fee: number; pay: number; pickup: number; prealert: number; mail: number; user: number; audit: number; nt: number };
};
const g = globalThis as unknown as { __wh13?: WhDb };
export const db: WhDb = (g.__wh13 ??= {
  items: [
    { id: 1, date: today(), carrier: "AMAZON", tracking: "TBA334984152752", receiver: "Demo", batch: "0" },
    { id: 2, date: today(), carrier: "FEDEX", tracking: "962200190000033194400087790594477", receiver: "Demo", batch: "0" },
  ],
  wrs: [], loads: [], shipments: [], bookings: [], orders: [], pickups: [], prealerts: [], users: [], maillog: [], audit: [], oldInvoices: [], oldWrs: [], oldShips: [], blockedEmails: [...BLOCKED_EMAILS], customers: [], reps: [],
  feeNames: { charge: [...FEE_PRESETS], credit: [...CREDIT_PRESETS] }, payMethods: [...PAY_METHODS], carriers: [...CARRIERS], settings: structuredClone(DEFAULT_SETTINGS),
  n: { wr: 11018, piece: 20032, item: 3, cargo: 611, inv: 5001, batch: 1, cust: 1001, rep: 1, fee: 1, pay: 1001, pickup: 1, prealert: 1, mail: 1, user: 1, audit: 1, nt: 1 },
});
export const nowStr = today;
// Cents: half a cent rounds UP (1.13 lb x $4.50 = 5.085 -> 5.09). The tiny extra only cancels binary floating-point error (5.085 is stored as 5.08499999...).
export const r2 = (n: number) => Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-7) / 100;
// The old rounding (5.085 -> 5.08), kept for what was invoiced before the change (pieces flagged `rd: 1` or `old`) and for purchase orders, so nothing already billed moves by a cent.
export const r2o = (n: number) => Math.round(n * 100) / 100;
export const legacyRound = (p: { old?: boolean; rd?: number }) => p.old === true || p.rd === 1;

// ---------- Receipt numbers ----------
// JPF = shipped by air, JPL = shipped by boat. The label code is  customer number | receipt | piece.
export const prefix = (ship: Ship) => (ship === "Ocean" ? "JPL" : "JPF");
export const wrCode = (w: Pick<WR, "ship" | "id">) => `${prefix(w.ship)}-${w.id}`;
export const labelCode = (w: WR, p: Piece) => `${w.cust}|${wrCode(w)}|${p.no}`;

// ---------- Customers and reps ----------
export const findCustomer = (q: string) => {
  const t = q.trim().toLowerCase();
  if (!t) return undefined;
  if (/^\d+$/.test(t)) return db.customers.find((c) => c.no === Number(t));
  if (t.includes("@")) return COMPANY_EMAILS.includes(t) ? undefined : db.customers.find((c) => c.email.toLowerCase() === t) ?? db.customers.find((c) => c.emailMore && c.emailMore.toLowerCase().split(/[;,\s]+/).includes(t));
  return db.customers.find((c) => c.name.toLowerCase() === t);
};
// Customers whose name is almost the same as the one typed (a typo like "Marie Josef"), so a new customer is not created by mistake.
const letters = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const distance = (a: string, b: string) => {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { const next = [i]; for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); row = next; }
  return row[b.length];
};
export const similarCustomers = (name: string, max = 3): Customer[] => {
  const t = letters(name);
  if (t.length < 4 || /^\d+$/.test(name.trim()) || name.includes("@")) return [];
  return db.customers.filter((c) => { const n = letters(c.name); return n === t || (Math.abs(n.length - t.length) <= 2 && distance(n, t) <= (t.length > 8 ? 2 : 1)); }).slice(0, max);
};
export const newCustomer = (name: string, init: Partial<Customer> = {}): Customer => {
  const c: Customer = {
    no: db.n.cust++, name, phone: "", email: "", billing: "", consignee: "", consigneePhone: "", consigneeAddress: "", consigneeCity: "",
    consigneeCountry: "Haiti", rep: "", route: "", ...init,
  };
  db.customers.push(c);
  return c;
};
// Who sends and who receives this receipt: what was typed on the receipt, else the customer (shipper) and the customer's consignee (receiver).
export const shipperOf = (w: WR) => { const c = custOf(w); return { name: w.shipperName || w.customer, phone: w.shipperPhone || c?.phone || "" }; };
export const receiverOf = (w: WR) => { const c = custOf(w); return { name: w.receiverName || c?.consignee || w.customer, phone: w.receiverPhone || c?.consigneePhone || c?.phone || "", address: w.receiverAddress || c?.consigneeAddress || "" }; };
export const creditOf = (c: Customer | undefined) => r2((c?.creditLog ?? []).reduce((a, e) => a + e.amount, 0));
export const custOf = (w: WR) => db.customers.find((c) => c.no === w.cust);
export const repOf = (id: string) => db.reps.find((r) => r.id === id);
export const repLabel = (id: string) => repOf(id)?.initials ?? "";

// A new, empty receipt for a customer. The route and rep default to the customer's.
export const openWR = (c: Customer, ship: Ship, init: Partial<WR> = {}): WR => {
  const w: WR = {
    id: String(db.n.wr++), date: nowStr(), customer: c.name, cust: c.no, email: c.email, route: c.route, rep: c.rep, ship,
    by: actorRef.get(), kind: "Personal", comments: "", contents: "", declared: 0, insurance: "Declined", fees: [], payments: [], pieces: [], dest: init.dest ?? destOf(c), rate: rateFor(c, ship, init.dest ?? destOf(c)), ...init,
  };
  if (ship === "Ocean") w.fees.push({ id: db.n.fee++, label: HANDLING_LABEL, amount: OCEAN_HANDLING, kind: "charge", auto: "handling" });
  db.wrs.unshift(w);
  return w;
};

// ---------- Shipments and bookings ----------
export const bookingOf = (name: string) => db.bookings.find((b) => b.shipment === name);
export { isoToday };
// The booking of a shipment, created with the usual defaults the first time it is opened.
export const openBooking = (sh: Shipment): Booking => {
  const ex = bookingOf(sh.name);
  if (ex) return ex;
  const air = sh.ship === "Air", usa = shToUSA(sh); // Haiti -> Miami: origin, destination, shipper and consignee are swapped
  const b: Booking = {
    shipment: sh.name, line: air ? AIRLINE : "", awb: "", bol: "", sailDate: isoToday(), origin: usa ? DESTINATION : ORIGIN, destination: usa ? ORIGIN : DESTINATION, vessel: air ? AIRLINE : "",
    blCost: 0, freightPayableAt: "", declared: 0,
    shipperName: usa ? HAITI.name : COMPANY.name, shipperAddress: usa ? HAITI.address : COMPANY.address, shipperCity: usa ? HAITI.city : COMPANY.city, shipperContact: usa ? HAITI.phone : COMPANY.phone,
    consigneeName: usa ? COMPANY.name : HAITI.name, consigneeAddress: usa ? COMPANY.address : HAITI.address, consigneeCity: usa ? COMPANY.city : HAITI.city, consigneeContact: usa ? COMPANY.phone : HAITI.phone,
    receiver: "", notify: "JP's Logistics Team", notifyContact: usa ? COMPANY.phone : HAITI.email,
    pieceType: "BOXES", commodity: "", sed: "NO", refrigeration: "NO", hazmat: "NO",
    containerSize: "", spotDate: "", spotTime: "", containerId: "", seal: "", tag: "", arrivalDate: "",
    ...(usa && { airportDep: "PAP", airportArr: "MIA" }),
    notes: "", signer: "", contents: [{ label: "Boxes", value: 0 }, { label: "Cargo", value: 0 }, { label: "", value: 0 }], pallets: {},
  };
  db.bookings.push(b);
  return b;
};
// What is loaded on a shipment, with the totals the documents print.
export const cargoOf = (name: string) => {
  const rows = db.loads.filter((l) => l.shipment === name).flatMap((l) => {
    const hit = findPiece(l.no);
    return hit ? [{ l, w: hit.w, p: hit.p }] : [];
  });
  const lbs = r2(rows.reduce((a, x) => a + x.p.lbs, 0));
  return {
    rows, lbs, kg: r2(lbs * 0.45359), chargeable: r2(rows.reduce((a, x) => a + chargeable(x.p), 0)),
    cuft: r2(rows.reduce((a, x) => a + cuft(x.p), 0)), pallets: [...new Set(rows.map((x) => x.l.pallet))],
  };
};

// ---------- Pieces ----------
// Air: volume in lb = L x W x H / 132. Ocean: cubic feet = L x W x H / 1788. Pieces made before this change (`old`) keep 139 and 1728.
export const AIR_DIVISOR = 132, CUFT_DIVISOR = 1788;
export const vol = (p: Piece) => (legacyRound(p) ? r2o : r2)((p.l * p.w * p.h) / (p.old ? 139 : AIR_DIVISOR));
export const cuft = (p: Piece) => (legacyRound(p) ? r2o : r2)((p.l * p.w * p.h) / (p.old ? 1728 : CUFT_DIVISOR));
// Once, when the data is loaded: the pieces of invoiced receipts keep the old formulas, so an invoice never changes by itself.
export function keepOldFormulas() { for (const w of db.wrs) if (w.invoice) for (const p of w.pieces) { if (p.old === undefined) p.old = true; if (p.rd === undefined) p.rd = 1; } }
export const chargeable = (p: Piece) => Math.max(p.lbs, vol(p));
// Looked up by number all the time (a shipment lists thousands of pieces): an index of the receipts, rebuilt when the list changes.
// A hit is checked before it is trusted (the piece may have been deleted or moved), else the receipts are searched.
let pieceIndex: { wrs: WR[]; len: number; map: Map<number, { w: WR; p: Piece }> } | null = null;
export const findPiece = (no: number) => {
  if (!pieceIndex || pieceIndex.wrs !== db.wrs || pieceIndex.len !== db.wrs.length) {
    const map = new Map<number, { w: WR; p: Piece }>();
    for (const w of db.wrs) for (const p of w.pieces) map.set(p.no, { w, p });
    pieceIndex = { wrs: db.wrs, len: db.wrs.length, map };
  }
  const hit = pieceIndex.map.get(no);
  if (hit && hit.w.pieces.includes(hit.p)) return hit;
  for (const w of db.wrs) { const p = w.pieces.find((x) => x.no === no); if (p) { pieceIndex.map.set(no, { w, p }); return { w, p }; } }
};

// ---------- Money ----------
// Charges and credits are typed in by staff as lines on each receipt (no fixed rate).
// Insurance is automatic: only when the customer accepted it and a declared value is set.
// Freight is automatic: Air = chargeable lb (larger of gross and volumetric weight) x rate, Ocean = cubic feet x rate.
export const freightQty = (w: WR) => r2(w.pieces.reduce((a, p) => a + (w.ship === "Ocean" ? cuft(p) : chargeable(p)), 0));
export const freightFee = (w: WR) => ((w.rate ?? 0) > 0 ? (w.pieces.some(legacyRound) ? r2o : r2)(freightQty(w) * (w.rate ?? 0)) : 0);
export const freightDesc = (w: WR) => `Freight Charges - Ref. WR: ${w.id} - (${freightQty(w)} ${w.ship === "Ocean" ? "cuf" : "lbs"}) - Number Of Pieces: ${w.pieces.length}`;
export const charges = (w: WR) => r2(freightFee(w) + w.fees.filter((f) => f.kind === "charge").reduce((a, f) => a + f.amount, 0));
export const credits = (w: WR) => r2(w.fees.filter((f) => f.kind === "credit").reduce((a, f) => a + f.amount, 0));
export const quote = (w: WR) => calcInsurance(w.declared);
export const insuranceFee = (w: WR) => (w.insurance === "Accepted" ? quote(w).customer : 0);
// The lines of a receipt or an invoice: ONE list used by the receipt page, the receipt PDF, the invoice page and the invoice PDF, so they can never disagree.
// Automatic freight (Air: chargeable lb x rate, Ocean: cubic feet x rate), then every fee, every credit (negative) and the insurance.
export type DocLine = { desc: string; amount: number; qty?: number; rate?: number };
export const docLines = (w: WR): DocLine[] => {
  const lbs = r2(w.pieces.reduce((a, p) => a + p.lbs, 0)), ref = ` - Ref. WR: ${w.id} - (${lbs} lbs) - Number Of Pieces: ${w.pieces.length}`;
  return [
    ...(freightFee(w) > 0 ? [{ desc: freightDesc(w), amount: freightFee(w), qty: freightQty(w), rate: w.rate }] : []),
    ...w.fees.map((f) => ({ desc: f.label + (/freight/i.test(f.label) ? ref : ""), amount: f.kind === "credit" ? -f.amount : f.amount })),
    ...(insuranceFee(w) > 0 ? [{ desc: `Certificate of insurance - Ref. WR: ${w.id} - declared value ${money(w.declared)}`, amount: quote(w).customer }] : []),
  ];
};
// A receipt that has something to pay (an estimate is not a debt until it is final): a fee line, or the automatic freight / insurance (an Air receipt often has no fee line at all).
export const priced = (w: WR) => (!w.estimate || !!w.invoice) && (w.fees.length > 0 || freightFee(w) > 0 || insuranceFee(w) > 0);
export const total = (w: WR) => Math.max(0, r2(charges(w) + insuranceFee(w) - credits(w)));
export const paidAmt = (w: WR) => r2(w.payments.reduce((a, p) => a + p.amount, 0));
export const balance = (w: WR) => r2(total(w) - paidAmt(w));
export const payStatus = (w: WR) => (paidAmt(w) <= 0 ? (total(w) <= 0 && priced(w) ? "No charge" : "Unpaid") : balance(w) <= 0 ? "Paid in full" : "Partially paid");
// Same helper as `priced` (a receipt that has something to pay, also when it only has the automatic freight line): kept under the name the audit uses.
export const hasCharges = priced;
export const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// What the same goods would cost shipped the other way (same pieces, standard rate of that method, its automatic handling fee).
export const otherShip = (w: WR): Ship => (w.ship === "Air" ? "Ocean" : "Air");
export const estimateFor = (w: WR, ship: Ship) => {
  const qty = r2(w.pieces.reduce((a, p) => a + (ship === "Ocean" ? cuft(p) : chargeable(p)), 0)), rate = rateFor(custOf(w), ship, w.dest);
  const freight = r2(qty * rate), handling = ship === "Ocean" ? OCEAN_HANDLING : 0;
  const isHandling = (f: Fee) => f.auto === "handling" || f.label.trim().toLowerCase() === HANDLING_LABEL.toLowerCase(); // a handling line typed by hand counts as handling too
  const extra = r2(w.fees.filter((f) => f.kind === "charge" && !isHandling(f)).reduce((a, f) => a + f.amount, 0));
  const ins = insuranceFee(w), cr = credits(w);
  return { ship, unit: ship === "Ocean" ? "cuf" : "lbs", qty, rate, freight, handling, extra, insurance: ins, credits: cr, total: Math.max(0, r2(freight + handling + extra + ins - cr)) };
};
// The receipt as the customer was last told about it: when it changes, the customer must be told again.
export const wrSig = (w: WR) => JSON.stringify([w.ship, w.rate, w.declared, w.insurance, w.estimate, w.pieces.map((p) => [p.no, p.l, p.w, p.h, p.lbs, p.contents]), w.fees.map((f) => [f.label, f.amount, f.kind])]);
export const lastNotice = (w: WR) => w.notices?.[w.notices.length - 1];
export const noticeState = (w: WR): "none" | "current" | "outdated" => { const n = lastNotice(w); return !n ? "none" : n.sig === wrSig(w) ? "current" : "outdated"; };
// What is inside the pieces (each piece has its own declared contents).
export const contentsOf = (w: WR) => [...new Set(w.pieces.map((p) => p.contents?.trim()).filter(Boolean))].join("; ") || w.contents;

// Lists that grow as staff type new values (fee names, payment methods, carriers).
export const remember = (list: string[], v: string) => { if (v && !list.some((x) => x.toLowerCase() === v.toLowerCase())) list.push(v); };

// ---------- Users and mail ----------
// Someone who signs in to this app. `perms` are the page links (see lib/menu.ts) they may open; an administrator may open everything.
export type User = { id: string; name: string; salt: string; hash: string; admin: boolean; perms: string[]; active: boolean; created: string; lastLogin?: string; defaultCode?: boolean };
// One e-mail sent from the app through the website (what, to how many, by whom).
// One line of the activity log: who did what, when, and how it ended.
export type AuditEntry = { id: number; date: string; time: string; user: string; action: string; detail: string; result: string };
// An invoice of the old billing system, kept for reference (history, statements, what is still owed). Its lines and the payments applied to it.
export type OldInvoice = {
  no: string; date: string; cust: number; consignee?: number; total: number; paid: boolean; method: string; shipment: string; ship: string; rep: string;
  lines: { d: string; q: number; u: number; a: number }[]; pays: { id: string; date: string; method: string; amount: number }[];
};
// The cargo history of the old system (Access: CASKWR, CASKITEMS, ItemsScanned, tblCargoBL, tblCargoList), kept for reference: what was received,
// which parcels (tracking numbers) were scanned, which pieces went on which shipment. Search it when a customer asks about an old parcel.
export type OldPiece = { n: number; type: string; l: number; w: number; h: number; lbs: number; cuft: number; contents: string; loaded: boolean; shipped: boolean; delivered: boolean };
export type OldScan = { t: string; date: string; carrier: string; ship: string; notified: boolean };
export type OldWR = { wr: string; date: string; shipper: string; billTo: number; cust: number; ship: string; kind: string; handling: number; other: number; credit: number; paid: number; method: string; contents: string; comments: string; invoiced: boolean; paidFull: boolean; pieces: OldPiece[]; scans: OldScan[]; ships: string[] };
export type OldShip = { id: string; type: string; name: string; awb: string; bol: string; date: string; sail: string; arrival: string; container: string; line: string; vessel: string; pieces: number; cost: number; shipper: string; consignee: string; items: number[] };
export type MailLog = { id: number; date: string; time: string; by: string; subject: string; to: string; sent: number; total: number; failed: string[] };

// ---------- Pre-alerts ----------
// No answer from the customer = Air.
export const effectiveShip = (p: Prealert): Ship => p.choice ?? "Air";

// ---------- Old invoices ----------
export const oldApplied = (o: OldInvoice) => r2(o.pays.reduce((a, p) => a + p.amount, 0));
// Open = the old system did not mark it paid and the payments applied do not cover it.
export const oldBalance = (o: OldInvoice) => (o.paid ? 0 : Math.max(0, r2(o.total - oldApplied(o))));
export const oldOpen = (o: OldInvoice) => oldBalance(o) > 0.01;

// ---------- Pickups ----------
export const pickupFeeLine = (p: Pickup) => db.wrs.find((w) => w.id === p.wr)?.fees.find((f) => f.id === p.feeId);
// What the customer is charged now: the live fee line on the receipt (staff may have edited it there).
export const pickupPrice = (p: Pickup) => (p.status === "Cancelled" ? 0 : pickupFeeLine(p)?.amount ?? p.price);

// ---------- Purchase orders ----------
export const ORDER_FEE_PCT = 15;
export const orderLine = (i: OrderItem) => r2o(i.qty * i.unit);
export const orderSubtotal = (o: Order) => r2(o.items.reduce((a, i) => a + orderLine(i), 0));
export const orderFee = (o: Order) => r2o((orderSubtotal(o) * o.feePct) / 100);
export const orderTotal = (o: Order) => r2(orderSubtotal(o) + orderFee(o));
export const orderPaid = (o: Order) => r2(o.payments.reduce((a, p) => a + p.amount, 0));
export const orderBalance = (o: Order) => r2(orderTotal(o) - orderPaid(o));
// Number like 100726-001: the date (MMDDYY) and the order of the day.
export const newOrderId = () => {
  const [m, d, y] = nowStr().split("/");
  const stem = `${m.padStart(2, "0")}${d.padStart(2, "0")}${y.slice(2)}`;
  return `${stem}-${String(db.orders.filter((o) => o.id.startsWith(stem)).length + 1).padStart(3, "0")}`;
};
export const orderNotes = (o: Order) =>
  o.notes || `***Prices include purchasing fees of ${o.feePct}% and shipping and delivery to Miami warehouse ****ETA 2 days Miami, Florida *****Full payment is required before purchasing ******Once the complete order will be in Miami warehouse, JP's will ship it out via Air Freight to Haiti.`;
