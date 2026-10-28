// Keeps the customer's space on the website up to date: every warehouse receipt that was sent to the customer (e-mail or WhatsApp) with its total, what was paid,
// the invoice when there is one, the "Pay online" link, the PDFs and a receipt link for each payment.
// The same file runs in the warehouse app (when a receipt is made and sent) and in the billing app (invoices and payments).
// A customer with no website account has nothing to push (the pay link in the e-mail still works). Runs after the request has answered.
import { db, total, paidAmt, balance, wrCode, priced, type WR } from "./wh-store";
import { flush } from "./persist";
import { syncEnabled, findClientId, pushSiteReceipt, dropSiteReceipt } from "./jps-sync";
import { payUrl, receiptUrl, docUrl } from "./paylink";

const g = globalThis as unknown as { __siteQ?: Promise<void>; __siteLast?: number };
// A receipt shows in the customer's space once it was sent to them (or invoiced).
const shown = (w: WR) => w.pieces.length > 0 && priced(w) && !!(w.invoice || w.waSig || (w.notices?.length ?? 0) > 0);
const sigOf = (w: WR) => `${w.ship}|${w.pieces.length}|${w.pieces.reduce((a, p) => a + p.lbs, 0)}|${w.invoice ?? ""}|${total(w)}|${paidAmt(w)}|${w.payments.map((p) => p.amount + p.method + p.ref).join(",")}`;
const cache = new Map<number, string>();
async function clientIdOf(cust: number): Promise<string | undefined> {
  const c = db.customers.find((x) => x.no === cust);
  if (!c) return undefined;
  if (c.clientId) return c.clientId;
  if (cache.has(cust)) return cache.get(cust) || undefined;
  const r = await findClientId(c.box || c.email || "");
  cache.set(cust, r.id ?? ""); return r.id;
}
async function run() {
  for (const w of db.wrs) {
    try {
      if (!shown(w)) { if (w.siteSig) { const e = await dropSiteReceipt(w.id); if (!e) { w.siteSig = undefined; w.siteUrl = false; } else console.error("[site-receipts]", e); } continue; }
      const sig = sigOf(w), bal = Math.max(0, balance(w)), url = bal > 0.004 ? payUrl(w) : "";
      if (w.siteSig === sig && !(url && !w.siteUrl)) continue;
      const cid = await clientIdOf(w.cust);
      if (!cid) { w.siteSig = sig; continue; }
      const paid = paidAmt(w), lbs = Math.round(w.pieces.reduce((a, p) => a + p.lbs, 0) * 100) / 100;
      const e = await pushSiteReceipt(
        {
          client_id: cid, wr_id: w.id, receipt_code: wrCode(w), receipt_date: w.date, ship: w.ship, pieces: w.pieces.length, weight: lbs, total: total(w), paid, balance: bal,
          status: paid <= 0 ? "unpaid" : bal <= 0.004 ? "paid" : "partial", invoice_no: w.invoice ?? null,
          // A link this app cannot make (no PAY_BASE_URL here) is left out, so it does not erase the one the other app wrote.
          ...(bal > 0.004 ? (url && { pay_url: url }) : { pay_url: "" }), ...(docUrl(w, "wr") && { wr_pdf_url: docUrl(w, "wr") }), ...(w.invoice && docUrl(w, "invoice") && { invoice_pdf_url: docUrl(w, "invoice") }),
        },
        w.payments.map((p, i) => ({ paid_on: `${p.date}${p.time ? " " + p.time : ""}`, amount: p.amount, method: p.method, reference: (p.ref ?? "").replace(/^stripe:/, ""), receipt_url: receiptUrl(w, i) })),
      );
      if (e) console.error("[site-receipts]", w.id, e); else { w.siteSig = sig; if (url) w.siteUrl = true; }
    } catch (e) { console.error("[site-receipts]", e instanceof Error ? e.message : e); }
  }
}
export function queueSiteReceipts() {
  if (!syncEnabled()) return;
  g.__siteQ = (g.__siteQ ?? Promise.resolve()).then(async () => { try { await run(); } finally { await flush().catch(() => {}); } });
}
// From the layout: at most every minute (catches what the other app changed).
export function syncSiteReceiptsSoon() {
  if (Date.now() - (g.__siteLast ?? 0) < 60_000) return; g.__siteLast = Date.now();
  queueSiteReceipts();
}
