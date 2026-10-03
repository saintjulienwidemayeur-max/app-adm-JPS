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
