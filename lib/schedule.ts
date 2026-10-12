// Departure schedule: Air shipments are prepared and sent every Friday, Ocean shipments every Wednesday.
// Instructions (Air or Ocean, "wait for other orders") must reach JP's at least 2 business days before the departure;
// a request that arrives later goes out with the next shipment. A customer who does not answer ships by Air.
import { isoToday } from "./clock";

export type ShipKind = "Air" | "Ocean";
export const DEPARTURE_DAY: Record<ShipKind, number> = { Air: 5, Ocean: 3 }; // 0 = Sunday ... 5 = Friday, 3 = Wednesday
export const CUTOFF_BUSINESS_DAYS = 2;
export const MAX_HOLD_DEPARTURES = 3;

const D = 86400000;
const t = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dow = (iso_: string) => new Date(t(iso_)).getUTCDay();

// `n` business days (Monday to Friday) before a date.
export function businessDaysBefore(date: string, n: number): string {
  let ms = t(date), left = n;
  while (left > 0) { ms -= D; const d = new Date(ms).getUTCDay(); if (d !== 0 && d !== 6) left--; }
  return iso(ms);
}
export const cutoffFor = (departure: string) => businessDaysBefore(departure, CUTOFF_BUSINESS_DAYS);

// The next departure that can still be prepared on `from`: its cutoff has not passed yet (the cutoff day itself still counts).
export function nextDeparture(ship: ShipKind, from = isoToday()): { departure: string; cutoff: string } {
  let ms = t(from);
  for (let i = 0; i < 30; i++, ms += D) {
    const day = iso(ms);
    if (dow(day) !== DEPARTURE_DAY[ship]) continue;
    const cutoff = cutoffFor(day);
    if (cutoff >= from) return { departure: day, cutoff };
  }
  return { departure: from, cutoff: from };
}
// The next `n` departures, starting with the one that can still be prepared.
export function departures(ship: ShipKind, n: number, from = isoToday()) {
  const out = [nextDeparture(ship, from)];
  while (out.length < n) out.push(nextDeparture(ship, iso(t(out[out.length - 1].departure) + D)));
  return out;
}
