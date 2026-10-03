// In-memory warehouse data (frontend mode). Resets when the dev server restarts.
export type Ship = "Air" | "Ocean";
export type Item = { id: number; date: string; carrier: string; tracking: string; receiver: string; batch: string; customer?: string; piece?: number; ship?: Ship; shipped?: boolean; wr?: string; clientId?: string };
export type Piece = { no: number; type: string; l: number; w: number; h: number; lbs: number };
export type Payment = { date: string; amount: number; method: string; ref: string };
export type WR = {
  id: string; date: string; customer: string; email: string; route: string; ship: Ship; comments: string;
  subtotal: number; handling: number; other: number; declared: number; insurance: "Declined" | "Accepted";
  invoice?: string; hereNotified?: boolean; ready?: boolean; payments: Payment[]; pieces: Piece[];
};
export type Load = { shipment: string; pallet: string; wr: string; no: number; date: string; here?: string };
export type Shipment = { name: string; ship: Ship; cargoId: string; date: string; shipped?: string };

const today = () => new Date().toLocaleDateString("en-US");
type WhDb = { items: Item[]; wrs: WR[]; loads: Load[]; shipments: Shipment[]; customers: Map<string, number>; n: { wr: number; piece: number; item: number; cargo: number; inv: number; batch: number } };
const g = globalThis as unknown as { __wh3?: WhDb };
export const db: WhDb = (g.__wh3 ??= {
  items: [
    { id: 1, date: today(), carrier: "AMAZON", tracking: "TBA334984152752", receiver: "Demo", batch: "0" },
    { id: 2, date: today(), carrier: "FEDEX", tracking: "962200190000033194400087790594477", receiver: "Demo", batch: "0" },
  ],
  wrs: [], loads: [], shipments: [], customers: new Map(), n: { wr: 11018, piece: 20032, item: 3, cargo: 611, inv: 5001, batch: 1 },
});
export const nowStr = today;
export const custId = (name: string) => {
  if (!db.customers.has(name)) db.customers.set(name, 1000 + db.customers.size * 7 + 1);
  return db.customers.get(name)!;
};
export const r2 = (n: number) => Math.round(n * 100) / 100;
export const vol = (p: Piece) => r2((p.l * p.w * p.h) / 139);
export const cuft = (p: Piece) => r2((p.l * p.w * p.h) / 1728);
export const chargeable = (p: Piece) => Math.max(p.lbs, vol(p));
export const labelCode = (w: WR, p: Piece) => `${custId(w.customer)}|JPF-${w.id}|${p.no}`;
export const findPiece = (no: number) => {
  for (const w of db.wrs) { const p = w.pieces.find((x) => x.no === no); if (p) return { w, p }; }
};
// The charge is typed in by staff for each receipt (no fixed rate).
export const subtotal = (w: WR) => w.subtotal;
export const total = (w: WR) => r2(subtotal(w) + w.handling + w.other);
export const paidAmt = (w: WR) => r2(w.payments.reduce((a, p) => a + p.amount, 0));
export const balance = (w: WR) => r2(total(w) - paidAmt(w));
export const payStatus = (w: WR) => (paidAmt(w) <= 0 ? "Unpaid" : balance(w) <= 0 ? "Paid in full" : "Partially paid");
export const money = (n: number) => `$${n.toFixed(2)}`;
