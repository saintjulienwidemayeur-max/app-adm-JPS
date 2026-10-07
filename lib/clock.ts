// Dates are the warehouse's local date (Miami), not the server's: Render runs in UTC, which would show tomorrow's date every evening.
// Change the zone with APP_TIMEZONE (an IANA name such as America/New_York).
export const TZ = process.env.APP_TIMEZONE || "America/New_York";

const parts = (d: Date) => {
  const o: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d)) o[p.type] = p.value;
  return o;
};
export const isoToday = (d = new Date()) => { const p = parts(d); return `${p.year}-${p.month}-${p.day}`; };
export const isoToUs = (iso: string) => { const [y, m, d] = iso.split("-"); return `${Number(m)}/${Number(d)}/${y}`; };
export const usToday = (d = new Date()) => isoToUs(isoToday(d));
export const timeNow = (d = new Date()) => { const p = parts(d); const h = Number(p.hour); return `${h % 12 || 12}:${p.minute} ${h < 12 ? "AM" : "PM"}`; };
