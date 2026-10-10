// In-memory warehouse data (frontend mode). Resets when the dev server restarts.
import { calcInsurance } from "./pricing";
import { usToday, isoToday, timeNow } from "./clock";
export { timeNow };
import { COMPANY, HAITI, ORIGIN, DESTINATION, AIRLINE } from "./company";

export type Ship = "Air" | "Ocean";
export type Item = { id: number; date: string; carrier: string; tracking: string; receiver: string; batch: string; customer?: string; piece?: number; ship?: Ship; shipped?: boolean; wr?: string; clientId?: string };
export type Piece = { no: number; type: string; l: number; w: number; h: number; lbs: number };
export type Payment = { date: string; time?: string; amount: number; method: string; ref: string; batch?: string };
// Money a customer paid beyond what they owed (positive) and credit used later (negative).
export type CreditEntry = { date: string; time: string; amount: number; note: string; batch?: string; method?: string; ref?: string };
export type Rep = { id: string; name: string; initials: string };
// A customer ("Bill To"). `no` is the customer number printed on every label (1001, 1002, ...).
// The consignee is the person who receives the cargo in the destination country; blank fields mean "same as the customer".
export type Customer = {
  no: number; name: string; phone: string; email: string; billing: string;
  consignee: string; consigneePhone: string; consigneeAddress: string; consigneeCity: string; consigneeCountry: string;
  rep: string; route: string; creditLog?: CreditEntry[];
};
// One line of "Fees and credits" on a receipt. Credits are subtracted from the total.
export type Fee = { id: number; label: string; amount: number; kind: "charge" | "credit" };
export type WR = {
  id: string; date: string; customer: string; cust: number; email: string; route: string; rep: string; ship: Ship;
  comments: string; contents: string; declared: number; insurance: "Declined" | "Accepted";
  fees: Fee[]; invoice?: string; invoiceDate?: string; invoiceSent?: string; hereNotified?: boolean; ready?: boolean; payments: Payment[]; pieces: Piece[];
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
export type Load = { shipment: string; pallet: string; wr: string; no: number; date: string; here?: string };
export type Shipment = { name: string; ship: Ship; cargoId: string; date: string; shipped?: string };

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
};

export const FEE_PRESETS = [
  "Freight charges", "Handling fees", "Packaging material E-container", "Packaging material EH-container",
  "Import Conatel fees", "DG paperwork", "Pickup fee", "Repacking and consolidation", "Storage fee", "TCA",
];
export const CREDIT_PRESETS = ["Credit", "Discount", "Auth Discount", "Credit memo"];
export const PAY_METHODS = ["Zelle", "Credit Card", "CashApp", "Cash", "Check", "Wire", "WISE", "Virement", "MonCash", "Voucher", "Credit Memo", "Auth Discount", "Depot", "NO CHARGE", "Other"];
export const CARRIERS = ["AMAZON", "FEDEX", "UPS", "DHL", "USPS", "GOFO", "ONTRAC", "LASERSHIP", "UNIUNI", "SHEIN", "TEMU", "WALMART", "TARGET", "BEST BUY", "EBAY", "HOME DEPOT", "COSTCO", "DRIVER", "OTHER"];
export const COUNTRIES = ["Haiti", "Dominican Republic", "United States", "Jamaica", "Bahamas", "Turks and Caicos", "Cuba", "Canada"];
export const DEFAULT_CONTENTS = "Personal Web orders(eBay, Amazon, Shein, Temu, etc.)";

const today = () => usToday();
type WhDb = {
  items: Item[]; wrs: WR[]; loads: Load[]; shipments: Shipment[]; bookings: Booking[]; orders: Order[]; pickups: Pickup[]; customers: Customer[]; reps: Rep[];
  feeNames: { charge: string[]; credit: string[] }; payMethods: string[]; carriers: string[];
  n: { wr: number; piece: number; item: number; cargo: number; inv: number; batch: number; cust: number; rep: number; fee: number; pay: number; pickup: number };
};
const g = globalThis as unknown as { __wh9?: WhDb };
export const db: WhDb = (g.__wh9 ??= {
  items: [
    { id: 1, date: today(), carrier: "AMAZON", tracking: "TBA334984152752", receiver: "Demo", batch: "0" },
    { id: 2, date: today(), carrier: "FEDEX", tracking: "962200190000033194400087790594477", receiver: "Demo", batch: "0" },
  ],
  wrs: [], loads: [], shipments: [], bookings: [], orders: [], pickups: [], customers: [], reps: [],
  feeNames: { charge: [...FEE_PRESETS], credit: [...CREDIT_PRESETS] }, payMethods: [...PAY_METHODS], carriers: [...CARRIERS],
  n: { wr: 11018, piece: 20032, item: 3, cargo: 611, inv: 5001, batch: 1, cust: 1001, rep: 1, fee: 1, pay: 1001, pickup: 1 },
});
export const nowStr = today;
export const r2 = (n: number) => Math.round(n * 100) / 100;

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
  if (t.includes("@")) return db.customers.find((c) => c.email.toLowerCase() === t);
  return db.customers.find((c) => c.name.toLowerCase() === t);
};
export const newCustomer = (name: string, init: Partial<Customer> = {}): Customer => {
  const c: Customer = {
    no: db.n.cust++, name, phone: "", email: "", billing: "", consignee: "", consigneePhone: "", consigneeAddress: "", consigneeCity: "",
    consigneeCountry: "Haiti", rep: "", route: "", ...init,
  };
  db.customers.push(c);
  return c;
};
export const creditOf = (c: Customer | undefined) => r2((c?.creditLog ?? []).reduce((a, e) => a + e.amount, 0));
export const custOf = (w: WR) => db.customers.find((c) => c.no === w.cust);
export const repOf = (id: string) => db.reps.find((r) => r.id === id);
export const repLabel = (id: string) => repOf(id)?.initials ?? "";

// A new, empty receipt for a customer. The route and rep default to the customer's.
export const openWR = (c: Customer, ship: Ship, init: Partial<WR> = {}): WR => {
  const w: WR = {
    id: String(db.n.wr++), date: nowStr(), customer: c.name, cust: c.no, email: c.email, route: c.route, rep: c.rep, ship,
    comments: "", contents: DEFAULT_CONTENTS, declared: 0, insurance: "Declined", fees: [], payments: [], pieces: [], ...init,
  };
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
  const air = sh.ship === "Air";
  const b: Booking = {
    shipment: sh.name, line: air ? AIRLINE : "", awb: "", bol: "", sailDate: isoToday(), origin: ORIGIN, destination: DESTINATION, vessel: air ? AIRLINE : "",
    blCost: 0, freightPayableAt: "", declared: 0,
    shipperName: COMPANY.name, shipperAddress: COMPANY.address, shipperCity: COMPANY.city, shipperContact: COMPANY.phone,
    consigneeName: HAITI.name, consigneeAddress: HAITI.address, consigneeCity: HAITI.city, consigneeContact: HAITI.phone,
    receiver: "", notify: "JP's Logistics Team", notifyContact: HAITI.email,
    pieceType: "BOXES", commodity: DEFAULT_CONTENTS, sed: "NO", refrigeration: "NO", hazmat: "NO",
    containerSize: "", spotDate: "", spotTime: "", containerId: "", seal: "", tag: "", arrivalDate: "",
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
export const vol = (p: Piece) => r2((p.l * p.w * p.h) / 139);
export const cuft = (p: Piece) => r2((p.l * p.w * p.h) / 1728);
export const chargeable = (p: Piece) => Math.max(p.lbs, vol(p));
export const findPiece = (no: number) => {
  for (const w of db.wrs) { const p = w.pieces.find((x) => x.no === no); if (p) return { w, p }; }
};

// ---------- Money ----------
// Charges and credits are typed in by staff as lines on each receipt (no fixed rate).
// Insurance is automatic: only when the customer accepted it and a declared value is set.
export const charges = (w: WR) => r2(w.fees.filter((f) => f.kind === "charge").reduce((a, f) => a + f.amount, 0));
export const credits = (w: WR) => r2(w.fees.filter((f) => f.kind === "credit").reduce((a, f) => a + f.amount, 0));
export const quote = (w: WR) => calcInsurance(w.declared);
export const insuranceFee = (w: WR) => (w.insurance === "Accepted" ? quote(w).customer : 0);
export const total = (w: WR) => Math.max(0, r2(charges(w) + insuranceFee(w) - credits(w)));
export const paidAmt = (w: WR) => r2(w.payments.reduce((a, p) => a + p.amount, 0));
export const balance = (w: WR) => r2(total(w) - paidAmt(w));
export const payStatus = (w: WR) => (paidAmt(w) <= 0 ? (total(w) <= 0 && w.fees.length ? "No charge" : "Unpaid") : balance(w) <= 0 ? "Paid in full" : "Partially paid");
export const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Lists that grow as staff type new values (fee names, payment methods, carriers).
export const remember = (list: string[], v: string) => { if (v && !list.some((x) => x.toLowerCase() === v.toLowerCase())) list.push(v); };

// ---------- Pickups ----------
export const pickupFeeLine = (p: Pickup) => db.wrs.find((w) => w.id === p.wr)?.fees.find((f) => f.id === p.feeId);
// What the customer is charged now: the live fee line on the receipt (staff may have edited it there).
export const pickupPrice = (p: Pickup) => (p.status === "Cancelled" ? 0 : pickupFeeLine(p)?.amount ?? p.price);

// ---------- Purchase orders ----------
export const ORDER_FEE_PCT = 15;
export const orderLine = (i: OrderItem) => r2(i.qty * i.unit);
export const orderSubtotal = (o: Order) => r2(o.items.reduce((a, i) => a + orderLine(i), 0));
export const orderFee = (o: Order) => r2((orderSubtotal(o) * o.feePct) / 100);
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
