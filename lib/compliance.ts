// What JP's needs from the customer before an online order is accepted for shipping (pre-alert), and what to check.
// Sources: U.S. Foreign Trade Regulations 15 CFR Part 30 (EEI/AES filing for a Schedule B line over $2,500, or when a license is needed;
// the commercial invoice, with real values, is the base document); TSA rules for air cargo (49 CFR Part 1548: cargo is screened,
// the shipper's identity is recorded); IATA Dangerous Goods Regulations (batteries, aerosols, liquids, perfume, paint: a shipper's
// declaration or exclusion, never "undeclared"). The Haiti side (customs duties, consignee identification) stays with JP's Haiti office.
export const EEI_LINE_LIMIT = 2500;

export type PrealertItem = { desc: string; qty: number; unit: number };
export const HAZARD_FLAGS = [
  ["battery", "Lithium or other batteries (phone, laptop, power bank, e-bike...)"],
  ["liquid", "Liquids, perfume, aerosol, paint, nail polish, hair spray"],
  ["pharma", "Medicine or pharmaceuticals"],
  ["food", "Food, plants or animal products"],
  ["other", "Other restricted item (weapon, ammunition, cash, ...)"],
  ["restricted", "Customer says: battery, liquid, aerosol or perfume"],
] as const;
export type HazardKey = (typeof HAZARD_FLAGS)[number][0];

export const lineTotal = (i: PrealertItem) => Math.round(i.qty * i.unit * 100) / 100;
export const itemsTotal = (items: PrealertItem[]) => Math.round(items.reduce((a, i) => a + lineTotal(i), 0) * 100) / 100;

// Tracking numbers: letters and digits only, at least 8 characters. A marketplace order number is NOT a tracking number:
// the carrier's own number is required (USPS, UPS, FedEx, DHL, Amazon TBA, SPEEDX, SWIFTX, UNIUNI, ...).
export const cleanTrackingNo = (v: string) => v.toUpperCase().replace(/[\s-]+/g, "");
export const trackingOk = (v: string) => /^[A-Z0-9]{8,40}$/.test(cleanTrackingNo(v));

// Messages the staff must resolve before the customer's shipment can go. Returns [] when nothing is missing.
export function reviewFlags(p: { items: PrealertItem[]; hazards: HazardKey[]; invoiceRef: string; consigneeName: string; consigneePhone: string }): string[] {
  const out: string[] = [];
  const big = p.items.filter((i) => lineTotal(i) > EEI_LINE_LIMIT);
  if (big.length) out.push(`A line is over $${EEI_LINE_LIMIT.toLocaleString("en-US")} (${big.map((i) => i.desc).join(", ")}): check whether an EEI / AES filing is required (15 CFR Part 30). The limit applies to each Schedule B commodity line.`);
  if (p.hazards.includes("battery") || p.hazards.includes("liquid") || p.hazards.includes("restricted")) out.push("Batteries, liquids or aerosols: ask for the product details, check the IATA dangerous goods rules before this goes by Air, and keep it off the shipment until cleared.");
  if (p.hazards.includes("pharma")) out.push("Pharmaceuticals: ask for the prescription or permit, and tick it on the Letter of Instruction.");
  if (p.hazards.includes("food")) out.push("Food, plants or animal products can need permits: confirm with the destination office.");
  if (p.hazards.includes("other")) out.push("Restricted item declared: do not accept until a manager has reviewed it.");
  if (!p.invoiceRef) out.push("No invoice reference: the signed declaration is the only proof of values. Ask the customer for the order invoice.");
  if (!p.consigneeName || !p.consigneePhone) out.push("The consignee name and phone are needed for delivery in Haiti.");
  return out;
}
