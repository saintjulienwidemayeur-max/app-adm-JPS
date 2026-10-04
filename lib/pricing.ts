export const VOLUMETRIC_DIVISOR = 139; // in³ per lb
export const RATE_PER_LB = 2.5;        // USD — move to a settings table when rates vary by route
export const MIN_CHARGE = 5;

export type Dims = { weightLbs: number; length: number; width: number; height: number };

export function calcPricing({ weightLbs, length, width, height }: Dims) {
  const volumetric = (length * width * height) / VOLUMETRIC_DIVISOR;
  const chargeable = Math.max(weightLbs, volumetric);
  const total = Math.max(MIN_CHARGE, chargeable * RATE_PER_LB);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { volumetric: r(volumetric), chargeable: r(chargeable), total: r(total) };
}

// Parcel insurance (certificate of insurance). Ported from the old Access function CalcCertIns:
//   cost to JP's = 1.22% of the declared value, minimum $27
//   customer pays = 3.5% of the declared value; when the 1.22% cost is $27 or less, the customer pays a flat $50
//   no declared value -> no insurance
export const INS_COST_RATE = 0.0122;
export const INS_CUSTOMER_RATE = 0.035;
export const INS_MIN_COST = 27;
export const INS_MIN_CUSTOMER = 50;

export function calcInsurance(declared: number) {
  const r = (n: number) => Math.round(n * 100) / 100;
  if (!(declared > 0)) return { jps: 0, customer: 0 };
  const calc = r(declared * INS_COST_RATE);
  return calc > INS_MIN_COST ? { jps: calc, customer: r(declared * INS_CUSTOMER_RATE) } : { jps: INS_MIN_COST, customer: INS_MIN_CUSTOMER };
}
