// Brings the invoices of the old billing system into the app (for reference: history, statements, what is still owed) from 4 CSV files
// made for this import: old_invoices, old_invoice_lines, old_payments, old_payment_applications. Importing again replaces the old invoices.
import { db, oldBalance, oldOpen, r2, type OldInvoice } from "./wh-store";
import { parseCsv } from "./csv";

type Table = Record<string, string>[];
function table(text: string, need: string[], name: string): { rows: Table; error?: string } {
  const raw = parseCsv(text);
  if (raw.length < 2) return { rows: [], error: `${name}: the file is empty.` };
  const head = raw[0].map((h) => h.trim().toLowerCase());
  if (head.includes("customer_no") && head.includes("name") && !head.includes("inv_no")) return { rows: [], error: `${name}: this looks like the customers file. Put the customers file in part 1 and the 4 old-billing files here.` };
  for (const n of need) if (!head.includes(n)) return { rows: [], error: `${name}: the column "${n}" is missing. Use the file made for this import.` };
  return { rows: raw.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()]))) };
}
const num = (s: string | undefined) => { const n = Number(s); return Number.isFinite(n) ? n : 0; };

export type BillingResult = { invoices: number; lines: number; payments: number; open: number; owed: number; paid: number; unknownCustomers: number; problems: string[] };
export function readBilling(files: { invoices: string; lines: string; payments: string; apps: string }): { list: OldInvoice[]; result: BillingResult; error?: string } {
  const inv = table(files.invoices, ["inv_no", "date", "customer_no", "total", "paid"], "Invoices"), lin = table(files.lines, ["inv_no", "description", "amount"], "Invoice lines");
  const pay = table(files.payments, ["payment_id", "date", "amount"], "Payments"), app = table(files.apps, ["payment_id", "inv_no", "amount"], "Payment applications");
  const empty = { invoices: 0, lines: 0, payments: 0, open: 0, owed: 0, paid: 0, unknownCustomers: 0, problems: [] as string[] };
  const bad = inv.error || lin.error || pay.error || app.error;
  if (bad) return { list: [], result: empty, error: bad };

  const byNo = new Map<string, OldInvoice>();
  for (const r of inv.rows) {
    if (!r.inv_no) continue;
    byNo.set(r.inv_no, { no: r.inv_no, date: r.date, cust: Math.round(num(r.customer_no)), consignee: r.consignee_no ? Math.round(num(r.consignee_no)) : undefined, total: r2(num(r.total)), paid: r.paid === "yes",
      method: r.pay_method ?? "", shipment: r.shipment ?? "", ship: r.ship_type ?? "", rep: r.rep_code ?? "", lines: [], pays: [] });
  }
  const problems: string[] = [];
  let orphanLines = 0, orphanApps = 0;
  for (const l of lin.rows) { const o = byNo.get(l.inv_no); if (o) o.lines.push({ d: l.description, q: num(l.qty) || 1, u: num(l.unit_price), a: r2(num(l.amount)) }); else orphanLines++; }
  const payById = new Map(pay.rows.map((p) => [p.payment_id, p]));
  for (const a of app.rows) {
    const o = byNo.get(a.inv_no), p = payById.get(a.payment_id);
    if (!o) { orphanApps++; continue; }
    o.pays.push({ id: a.payment_id, date: p?.date ?? "", method: p?.method ?? "", amount: r2(num(a.amount)) });
  }
  if (orphanLines) problems.push(`${orphanLines} invoice lines belong to an invoice that is not in the file (ignored).`);
  if (orphanApps) problems.push(`${orphanApps} payment applications belong to an invoice that is not in the file (ignored).`);
  const list = [...byNo.values()].sort((a, b) => a.date.localeCompare(b.date) || Number(a.no) - Number(b.no));
  const known = new Set(db.customers.map((c) => c.no));
  const open = list.filter(oldOpen);
  return { list, result: { invoices: list.length, lines: lin.rows.length - orphanLines, payments: pay.rows.length, open: open.length, owed: r2(open.reduce((s, o) => s + oldBalance(o), 0)), paid: list.length - open.length,
    unknownCustomers: new Set(list.filter((o) => !known.has(o.cust)).map((o) => o.cust)).size, problems } };
}
