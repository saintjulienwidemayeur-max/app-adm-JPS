// Price estimate for a customer's boxes: Air and Ocean side by side.
//   Air   = the larger of gross and volumetric weight (L x W x H / 139 per box) x rate per lb
//   Ocean = cubic feet (L x W x H / 1728 per box) x rate per cubic foot, plus the Ocean handling fee
// Same rounding as a warehouse receipt (per box, 2 decimals), so an estimate and the receipt made from it agree.
import { calcInsurance } from "./pricing";

export const EST_AIR_RATE = 4.5, EST_OCEAN_RATE = 16;
export const EST_AIR_HANDLING = 35, EST_OCEAN_HANDLING = 45; // minimums printed in the disclaimer
export const EST_MAX_ROWS = 20;

const r2 = (n: number) => Math.round(n * 100) / 100;
export type EstRow = { qty: number; l: number; w: number; h: number; lbs: number; contents: string };
export type EstInput = {
  customer: string; rows: EstRow[]; incomplete: number[]; rateAir: number; rateOcean: number; handlingAir: number; handlingOcean: number;
  declared: number; insure: boolean; pickup: number; repack: number; otherLabel: string; other: number; credit: number;
};
export type EstLine = { label: string; detail?: string; amount: number; kind?: "credit" };
export type EstOption = { ship: "Air" | "Ocean"; unit: "lbs" | "cuft"; qty: number; rate: number; lines: EstLine[]; total: number };

const n = (v: string | undefined) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0; };

// Reads an estimate from named values (the page's query string, or a submitted form).
export function parseEstimate(get: (k: string) => string | undefined): EstInput {
  const rows: EstRow[] = [], incomplete: number[] = [];
  for (let i = 0; i < EST_MAX_ROWS; i++) {
    const r = { qty: Math.min(500, Math.max(1, Math.round(n(get(`q_${i}`)) || 1))), l: n(get(`l_${i}`)), w: n(get(`w_${i}`)), h: n(get(`h_${i}`)), lbs: n(get(`lbs_${i}`)), contents: (get(`c_${i}`) ?? "").trim() };
    const filled = [r.l, r.w, r.h, r.lbs].filter(Boolean).length;
    if (filled === 4 && Math.max(r.l, r.w, r.h) <= 200 && r.lbs <= 2000) rows.push(r);
    else if (filled > 0 || get(`q_${i}`) || r.contents) incomplete.push(i + 1);
  }
  const pos = (k: string, d: number) => (get(k) === undefined || get(k) === "" ? d : n(get(k)));
  return {
    customer: (get("customer") ?? "").trim(), rows, incomplete,
    rateAir: pos("rateAir", EST_AIR_RATE), rateOcean: pos("rateOcean", EST_OCEAN_RATE), handlingAir: pos("handlingAir", EST_AIR_HANDLING), handlingOcean: pos("handlingOcean", EST_OCEAN_HANDLING),
    declared: n(get("declared")), insure: get("insure") === "yes", pickup: n(get("pickup")), repack: n(get("repack")),
    otherLabel: (get("otherLabel") ?? "").trim(), other: n(get("other")), credit: n(get("credit")),
  };
}

export function rowFigures(r: EstRow) {
  const vol1 = r2((r.l * r.w * r.h) / 139), cu1 = r2((r.l * r.w * r.h) / 1728), ch1 = Math.max(r.lbs, vol1);
  return { gross: r2(r.lbs * r.qty), volumetric: r2(vol1 * r.qty), cuft: r2(cu1 * r.qty), chargeable: r2(ch1 * r.qty), byVolume: vol1 > r.lbs };
}

export function estimate(i: EstInput) {
  const f = i.rows.map(rowFigures);
  const sum = (k: "gross" | "volumetric" | "cuft" | "chargeable") => r2(f.reduce((a, x) => a + x[k], 0));
  const totals = { pieces: i.rows.reduce((a, r) => a + r.qty, 0), gross: sum("gross"), volumetric: sum("volumetric"), cuft: sum("cuft"), chargeable: sum("chargeable") };
  const insurance = i.insure && i.declared > 0 ? calcInsurance(i.declared).customer : 0;
  const common: EstLine[] = [
    ...(insurance > 0 ? [{ label: "Certificate of insurance", detail: `declared value $${i.declared.toFixed(2)} (minimum $50)`, amount: insurance }] : []),
    ...(i.pickup > 0 ? [{ label: "Pickup fee", amount: i.pickup }] : []),
    ...(i.repack > 0 ? [{ label: "Repacking and consolidation", amount: i.repack }] : []),
    ...(i.other > 0 ? [{ label: i.otherLabel || "Other", amount: i.other }] : []),
    ...(i.credit > 0 ? [{ label: "Discount / credit", amount: i.credit, kind: "credit" as const }] : []),
  ];
  const make = (ship: "Air" | "Ocean"): EstOption => {
    const air = ship === "Air", qty = air ? totals.chargeable : totals.cuft, rate = air ? i.rateAir : i.rateOcean, handling = air ? i.handlingAir : i.handlingOcean;
    const lines: EstLine[] = [
      { label: "Freight charges", detail: `${qty} ${air ? "lbs" : "cuft"} x $${rate.toFixed(2)}${air ? " (larger of gross and volumetric weight)" : ""}`, amount: r2(qty * rate) },
      ...(handling > 0 ? [{ label: "Handling fees", amount: handling }] : []),
      ...common,
    ];
    const total = Math.max(0, r2(lines.reduce((a, l) => a + (l.kind === "credit" ? -l.amount : l.amount), 0)));
    return { ship, unit: air ? "lbs" : "cuft", qty, rate, lines, total };
  };
  const air = make("Air"), ocean = make("Ocean");
  return { figures: f, totals, air, ocean, cheaper: air.total === ocean.total ? null : air.total < ocean.total ? air : ocean };
}
