// Brings the customers of the old system into the app from a CSV file (one line per customer, with a header line).
// Columns (extra columns are ignored): customer_no, name, company, contact, street, city, state, zip, country, phone, whatsapp, alt_phone,
// email, email_more, rate_ocean, rate_air, rate_capa, rate_capo, rate_sdq, rate_droc, id_on_file, rep_code, created.
// Customer numbers are kept (they are on the labels and the old documents).
import { db, type Customer, type CustomerRates } from "./wh-store";
import { parseCsv } from "./csv";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const sp = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const rate = (s: string | undefined) => { const n = Number((s ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(n) && n > 0 && n < 1000 ? Math.round(n * 100) / 100 : undefined; };
export function countryOf(s: string | undefined): string {
  const t = sp(s).toLowerCase();
  if (!t || ["haiti", "haïti", "ht", "ayiti"].includes(t)) return "Haiti";
  if (["usa", "us", "u.s.a", "u.s.", "united states", "united states of america", "etats-unis", "états-unis"].includes(t)) return "United States";
  if (t.startsWith("dom") || t.includes("domin") || t === "rd" || t.startsWith("rep dom")) return "Dominican Republic";
  return sp(s);
}
const emailsOf = (s: string | undefined) => [...new Set((s ?? "").toLowerCase().split(/[;,\s]+/).map((e) => e.replace(/^<|>$/g, "")).filter((e) => EMAIL.test(e)))];

export type ImportLine = Omit<Customer, "creditLog" | "rep" | "route" | "consignee"> & { consignee: string; rep: string; route: string };

// The text of an uploaded file: UTF-8 (with or without BOM), else Windows-1252 (a CSV saved by Excel).
export function decodeCsv(buf: ArrayBuffer): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { return new TextDecoder("windows-1252").decode(buf); }
}

export function readLines(text: string): { lines: ImportLine[]; problems: string[] } {
  const rows = parseCsv(text), problems: string[] = [];
  if (rows.length < 2) return { lines: [], problems: ["The file is empty, or it has no header line."] };
  const head = rows[0].map((h) => sp(h).toLowerCase());
  const at = (r: string[], k: string) => { const i = head.indexOf(k); return i < 0 ? "" : r[i] ?? ""; };
  for (const need of ["customer_no", "name"]) if (!head.includes(need)) return { lines: [], problems: [`The header line has no "${need}" column. Use the file made for this import.`] };
  const lines: ImportLine[] = [], seen = new Set<number>();
  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2, no = Math.round(Number(at(r, "customer_no"))), name = sp(at(r, "name"));
    if (!Number.isInteger(no) || no < 1) return void problems.push(`Line ${line}: customer number "${at(r, "customer_no")}" is not a number.`);
    if (!name) return void problems.push(`Line ${line}: customer ${no} has no name.`);
    if (seen.has(no)) return void problems.push(`Line ${line}: customer number ${no} appears twice (the first one is kept).`);
    seen.add(no);
    const em = emailsOf(at(r, "email")).concat(emailsOf(at(r, "email_more"))).filter((e, i, a) => a.indexOf(e) === i);
    const street = sp(at(r, "street")), city = sp(at(r, "city")), state = sp(at(r, "state")), zip = sp(at(r, "zip")), country = countryOf(at(r, "country"));
    const company = sp(at(r, "company")), contact = sp(at(r, "contact"));
    const phone = sp(at(r, "phone")), whatsapp = sp(at(r, "whatsapp")), alt = sp(at(r, "alt_phone"));
    const rates: CustomerRates = { ocean: rate(at(r, "rate_ocean")), air: rate(at(r, "rate_air")), capa: rate(at(r, "rate_capa")), capo: rate(at(r, "rate_capo")), sdq: rate(at(r, "rate_sdq")), droc: rate(at(r, "rate_droc")) };
    const other = [contact, company].find((x) => x && x.toLowerCase() !== name.toLowerCase()) ?? "";
    lines.push({
      no, name, phone: phone || whatsapp || alt, email: em[0] ?? "", emailMore: em.slice(1).join("; ") || undefined,
      billing: [street, city, state, zip, country].filter(Boolean).join(", "),
      consignee: other, consigneePhone: phone || whatsapp || alt, consigneeAddress: street, consigneeCity: [city, state].filter(Boolean).join(", "), consigneeCountry: country,
      rep: "", route: "", whatsapp: whatsapp || undefined, altPhone: alt || undefined, idOnFile: /^(yes|true|1|-1|oui)$/i.test(sp(at(r, "id_on_file"))) || undefined,
      legacyRep: sp(at(r, "rep_code")) || undefined, since: sp(at(r, "created")) || undefined, rates: Object.values(rates).some(Boolean) ? rates : undefined,
    });
  });
  return { lines, problems };
}

export type ImportResult = { added: number; updated: number; unchanged: number; conflicts: string[]; problems: string[]; total: number };
// Adds the customers that are not here yet. A customer already here (same number) is only completed (blank fields filled), or
// updated from the file when `overwrite` is on. A number used here by someone else is a conflict: nothing is changed for that line.
// Several customers may share one e-mail address (a company with many accounts): that is not a conflict.
export function importLines(lines: ImportLine[], overwrite: boolean, dryRun: boolean): ImportResult {
  const res: ImportResult = { added: 0, updated: 0, unchanged: 0, conflicts: [], problems: [], total: lines.length };
  const byNo = new Map(db.customers.map((c) => [c.no, c]));
  for (const l of lines) {
    const same = byNo.get(l.no);
    if (same && same.name.toLowerCase() !== l.name.toLowerCase() && !(l.email && same.email.toLowerCase() === l.email)) { res.conflicts.push(`${l.no}: already used by ${same.name} (the file says ${l.name})`); continue; }
    if (!same) {
      res.added++;
      if (!dryRun) { const c: Customer = { ...l } as Customer; db.customers.push(c); byNo.set(c.no, c); }
      continue;
    }
    // Customer already here: fill the blanks (or replace what the file has).
    let changed = false;
    for (const [k, v] of Object.entries(l) as [keyof Customer, unknown][]) {
      if (k === "no" || k === "rep" || k === "route" || v === undefined || v === "") continue;
      const cur = (same as unknown as Record<string, unknown>)[k];
      const empty = cur === undefined || cur === "";
      if (empty || overwrite) {
        if (JSON.stringify(cur) !== JSON.stringify(v)) { changed = true; if (!dryRun) (same as unknown as Record<string, unknown>)[k] = v; }
      }
    }
    if (changed) res.updated++; else res.unchanged++;
  }
  if (!dryRun) {
    db.customers.sort((a, b) => a.no - b.no);
    db.n.cust = Math.max(db.n.cust, ...db.customers.map((c) => c.no + 1));
  }
  return res;
}
