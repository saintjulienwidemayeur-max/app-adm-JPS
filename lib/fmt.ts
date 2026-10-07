// Small formatting helpers shared by the printable documents.
export const longDate = (d: string) => {
  const t = new Date(d.length === 10 && d.includes("-") ? `${d}T00:00` : d);
  return isNaN(t.getTime()) ? d : t.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
};
export const shortDate = (d: string) => {
  if (!d) return "";
  const t = new Date(d.length === 10 && d.includes("-") ? `${d}T00:00` : d);
  return isNaN(t.getTime()) ? d : t.toLocaleDateString("en-US");
};
export const r1 = (n: number) => Math.round(n * 10) / 10;
export const cm = (inches: number) => r1(inches * 2.54);

// "October 7th, 2026" from a stored M/D/YYYY date.
export const ordinalDate = (us: string) => {
  const [m, d, y] = us.split("/").map(Number);
  const suffix = d % 100 >= 11 && d % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[d % 10] ?? "th";
  return `${new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" })} ${d}${suffix}, ${y}`;
};
