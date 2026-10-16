// PDF of the warehouse receipt and of the invoice (the same content as the printed pages), made on the server so it can be e-mailed and kept.
// pdf-lib draws with the standard PDF fonts: only Latin-1 text, anything else is replaced (see `safe`).
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { DISCLAIMER, ESTIMATE_NOTE } from "./disclaimer";
import { COMPANY } from "./company";
import { cardFees } from "./pricing";
import { db, vol, cuft, chargeable, r2, charges, credits, quote, insuranceFee, total, paidAmt, balance, payStatus, money, wrCode, custOf, freightFee, freightQty, freightDesc, contentsOf, repOf, type WR } from "./wh-store";

const MAP: Record<string, string> = { "−": "-", "–": "-", "—": "-", "·": "-", "•": "*", "‘": "'", "’": "'", "“": '"', "”": '"', "…": "...", "→": "->", "×": "x", "≥": ">=", "€": "EUR", " ": " " };
const safe = (s: unknown) => String(s ?? "").normalize("NFC").replace(/[^\x20-\x7e¡-ÿ]/g, (c) => MAP[c] ?? (c === "\n" ? " " : "?"));
const BLUE = rgb(0.125, 0.2, 0.56), GREY = rgb(0.35, 0.35, 0.38), BLACK = rgb(0.05, 0.05, 0.07), LINE = rgb(0.75, 0.77, 0.85);

class Doc {
  pdf!: PDFDocument; page!: PDFPage; font!: PDFFont; bold!: PDFFont; logo?: PDFImage;
  W = 595.28; H = 841.89; M = 40; y = 0;
  static async make(): Promise<Doc> {
    const d = new Doc();
    d.pdf = await PDFDocument.create();
    d.font = await d.pdf.embedFont(StandardFonts.Helvetica); d.bold = await d.pdf.embedFont(StandardFonts.HelveticaBold);
    try { d.logo = await d.pdf.embedPng(fs.readFileSync(path.join(process.cwd(), "public", "logo.png"))); } catch { /* no logo file: the text header is enough */ }
    d.add();
    return d;
  }
  add() { this.page = this.pdf.addPage([this.W, this.H]); this.y = this.H - this.M; }
  need(h: number) { if (this.y - h < this.M) this.add(); }
  width(s: string, size: number, bold = false) { return (bold ? this.bold : this.font).widthOfTextAtSize(safe(s), size); }
  text(s: string, x: number, size = 10, o: { bold?: boolean; color?: ReturnType<typeof rgb>; right?: number } = {}) {
    const t = safe(s), f = o.bold ? this.bold : this.font;
    const px = o.right !== undefined ? o.right - f.widthOfTextAtSize(t, size) : x;
    this.page.drawText(t, { x: px, y: this.y - size, size, font: f, color: o.color ?? BLACK });
  }
  wrap(s: string, w: number, size: number, bold = false): string[] {
    const out: string[] = []; const f = bold ? this.bold : this.font;
    for (const para of safe(s).split(/\n/)) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const t = line ? line + " " + word : word;
        if (f.widthOfTextAtSize(t, size) <= w || !line) line = t; else { out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  }
  // A paragraph (wrapped), returns the height used.
  para(s: string, x: number, w: number, size = 10, o: { bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number } = {}) {
    const lh = size * 1.3;
    for (const l of this.wrap(s, w, size, o.bold)) { this.need(lh); this.text(l, x, size, o); this.y -= lh; }
    this.y -= o.gap ?? 0;
  }
  rule(x1 = this.M, x2 = this.W - this.M, thick = 0.7, color = LINE) { this.page.drawLine({ start: { x: x1, y: this.y }, end: { x: x2, y: this.y }, thickness: thick, color }); }
  // A table row: columns [{ w, text, right?, bold? }]; cells wrap; returns after drawing.
  row(cols: { w: number; t: string; right?: boolean; bold?: boolean }[], size = 9, o: { head?: boolean; border?: boolean } = {}) {
    const pad = 3, lh = size * 1.28;
    const cells = cols.map((c) => this.wrap(c.t, c.w - pad * 2, size, c.bold || o.head));
    const h = Math.max(...cells.map((l) => l.length)) * lh + 4;
    this.need(h);
    let x = this.M;
    if (o.head) this.page.drawRectangle({ x: this.M, y: this.y - h, width: cols.reduce((a, c) => a + c.w, 0), height: h, color: rgb(0.92, 0.94, 0.98) });
    cols.forEach((c, i) => {
      cells[i].forEach((ln, k) => { const f = c.bold || o.head ? this.bold : this.font; const tx = c.right ? x + c.w - pad - f.widthOfTextAtSize(ln, size) : x + pad; this.page.drawText(ln, { x: tx, y: this.y - 2 - size - k * lh, size, font: f, color: o.head ? BLUE : BLACK }); });
      x += c.w;
    });
    this.y -= h;
    if (o.border !== false) this.rule(this.M, this.M + cols.reduce((a, c) => a + c.w, 0), 0.5);
  }
  header(rightLines: string[]) {
    if (this.logo) { const w = 120, h = (w * this.logo.height) / this.logo.width; this.page.drawImage(this.logo, { x: this.M, y: this.y - h, width: w, height: h }); } else { this.text(COMPANY.name, this.M, 14, { bold: true, color: BLUE }); }
    let yy = this.y;
    for (const l of rightLines) { this.page.drawText(safe(l), { x: this.W - this.M - this.font.widthOfTextAtSize(safe(l), 9), y: yy - 9, size: 9, font: this.font, color: GREY }); yy -= 12; }
    this.y -= this.logo ? Math.max(120 * this.logo.height / this.logo.width, rightLines.length * 12) + 6 : 24;
  }
  async bytes() { return await this.pdf.save(); }
}

const longDate = (d: string) => { const t = new Date(d); return isNaN(t.getTime()) ? d : t.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }); };

// ---------- Warehouse receipt ----------
export async function receiptPdf(w: WR): Promise<Uint8Array> {
  const d = await Doc.make(), c = custOf(w), M = d.M, CW = d.W - 2 * M;
  const consignee = c?.consignee || w.customer, place = [c?.consigneeCity, c?.consigneeCountry].filter(Boolean).join(", "), phone = c?.consigneePhone || c?.phone;
  d.header([longDate(w.date), COMPANY.name, `${COMPANY.address}, ${COMPANY.city}`, COMPANY.phone]);
  d.y -= 4; d.text("Warehouse Receipt", 0, 20, { bold: true, right: d.W / 2 + d.width("Warehouse Receipt", 20, true) / 2 }); d.y -= 30;
  const top = d.y;
  d.text("Shipper", M, 9, { color: GREY }); d.text(`${w.customer} (customer ${w.cust})`, M + 48, 10, { bold: true }); d.y -= 14;
  if (c?.billing) d.para(c.billing, M, 300, 9.5);
  d.y -= 4; d.text("Consignee", M, 9, { color: GREY }); d.text(consignee, M + 48, 10, { bold: true }); d.y -= 14;
  for (const l of [c?.consigneeAddress, place, phone && `Phone ${phone}`, w.email && `eMail ${w.email}`].filter(Boolean) as string[]) d.para(l, M, 300, 9.5);
  const afterLeft = d.y; d.y = top;
  d.page.drawRectangle({ x: d.W - M - 150, y: d.y - 34, width: 150, height: 34, borderColor: GREY, borderWidth: 1.5 });
  d.text("WR #", 0, 9, { color: GREY, right: d.W - M - 150 + 38 }); d.page.drawText(safe(wrCode(w)), { x: d.W - M - 108, y: d.y - 23, size: 15, font: d.bold, color: BLACK });
  d.y -= 44; d.text(`Ship Type: ${w.ship}${w.route ? `   Route: ${w.route}` : ""}`, 0, 9.5, { right: d.W - M }); d.y = Math.min(afterLeft, d.y - 14) - 10;
  // pieces
  const cols = [{ w: 48, t: "Item #" }, { w: 215, t: "Description" }, { w: 55, t: "Weight", right: true }, { w: 45, t: "CUFT", right: true }, { w: CW - 363, t: "Contents" }];
  d.row(cols, 9, { head: true });
  w.pieces.forEach((p, i) => d.row([{ w: 48, t: String(p.no) }, { w: 215, t: `${p.type} - (in) L${p.l} X W${p.w} X H${p.h} - ${vol(p)} lbs*` }, { w: 55, t: String(p.lbs), right: true }, { w: 45, t: String(cuft(p)), right: true }, { w: CW - 363, t: p.contents ?? (i === 0 ? w.contents : "") }]));
  d.y -= 8; d.need(70);
  const gross = r2(w.pieces.reduce((a, p) => a + p.lbs, 0)), cf = r2(w.pieces.reduce((a, p) => a + cuft(p), 0)), chg = r2(w.pieces.reduce((a, p) => a + chargeable(p), 0));
  const stats: [string, string][] = [["Total Pieces", String(w.pieces.length)], ["Gross Weight", `${gross} lbs`], ["Total Cubic ft", `${cf} cuft`], ["Total Chargeable", `${chg} lbs`]];
  stats.forEach(([k, v], i) => { const x = M + (CW / 4) * i; d.page.drawText(safe(k), { x, y: d.y - 9, size: 8.5, font: d.bold, color: GREY }); d.page.drawText(safe(v), { x, y: d.y - 24, size: 12, font: i === 3 ? d.bold : d.font, color: BLACK }); });
  d.y -= 34; d.rule(M, d.W - M, 1.4, BLACK); d.y -= 8;
  d.text("Declared Contents", M, 9.5, { bold: true }); d.text(`Declared Value ${money(w.declared)}`, 0, 9.5, { bold: true, right: d.W - M }); d.y -= 14;
  d.para(contentsOf(w) || "-", M, CW, 9.5, { gap: 4 });
  d.para(w.insurance === "Declined" ? "CUSTOMER DECLINED INSURANCE COVERAGE" : w.declared > 0 ? `INSURANCE ACCEPTED - declared value ${money(w.declared)}` : "INSURANCE ACCEPTED (no declared value)", M, CW, 10, { bold: true, gap: 2 });
  if (w.comments) d.para(`Comments: ${w.comments}`, M, CW, 9.5, { gap: 4 });
  if (w.estimate) {
    d.y -= 4; d.para("Estimate", M, CW, 13, { bold: true, color: BLUE, gap: 2 });
    const rows: [string, string][] = [];
    if (freightFee(w) > 0) rows.push([`${freightDesc(w)} (${freightQty(w)} x ${money(w.rate ?? 0)})`, money(freightFee(w))]);
    for (const f of w.fees) rows.push([f.label, `${f.kind === "credit" ? "-" : ""}${money(f.amount)}`]);
    if (insuranceFee(w) > 0) rows.push(["Certificate of insurance", money(quote(w).customer)]);
    for (const [k, v] of rows) d.row([{ w: CW - 90, t: k }, { w: 90, t: v, right: true }], 9);
    d.y -= 4;
    const sum: [string, string, boolean?][] = [];
    if (credits(w) > 0) sum.push(["Charges", money(charges(w) + insuranceFee(w))], ["Credits", `-${money(credits(w))}`]);
    sum.push(["Total", money(total(w)), true], ["Paid", money(paidAmt(w))], ["Balance", money(balance(w))], ["Status", payStatus(w)]);
    for (const [k, v, b] of sum) { d.need(14); d.text(k, d.W - M - 190, 10, { bold: !!b }); d.text(v, 0, 10, { bold: !!b, right: d.W - M }); d.y -= 14; }
    if (balance(w) > 0) { const card = cardFees(balance(w)); d.y -= 4; d.para(`If paying with credit card: card present ${money(card.present.total)} - pay online ${money(card.invoice.total)}`, M, CW, 9, { color: GREY, gap: 4 }); }
    d.para(ESTIMATE_NOTE, M, CW, 8.5, { gap: 4 });
  } else d.para("This receipt confirms what JP's received. The final invoice is issued when the shipment has cleared customs and been delivered to our destination office.", M, CW, 8.5, { color: GREY, gap: 4 });
  d.y -= 6; d.need(30); d.text("THANK YOU FOR YOUR BUSINESS", 0, 13, { bold: true, color: GREY, right: d.W / 2 + d.width("THANK YOU FOR YOUR BUSINESS", 13, true) / 2 }); d.y -= 22;
  d.para("***** Disclaimer *****", M, CW, 10, { bold: true, color: GREY, gap: 2 });
  for (const t of DISCLAIMER) d.para("- " + t, M, CW, 7.6, { color: GREY });
  return d.bytes();
}

// ---------- Invoice ----------
export async function invoicePdf(w: WR): Promise<Uint8Array> {
  const d = await Doc.make(), c = custOf(w), M = d.M, CW = d.W - 2 * M;
  const lbs = r2(w.pieces.reduce((a, p) => a + p.lbs, 0));
  const shipment = db.loads.find((l) => l.wr === w.id)?.shipment ?? "";
  const ref = ` - Ref. WR: ${w.id} - (${lbs} lbs) - Number Of Pieces: ${w.pieces.length}`;
  type Line = { desc: string; amount: number; qty?: number; rate?: number };
  const lines: Line[] = [
    ...(freightFee(w) > 0 ? [{ desc: freightDesc(w), amount: freightFee(w), qty: freightQty(w), rate: w.rate }] : []),
    ...w.fees.map((f) => ({ desc: f.label + (/freight/i.test(f.label) ? ref : ""), amount: f.kind === "credit" ? -f.amount : f.amount })),
    ...(insuranceFee(w) > 0 ? [{ desc: `Certificate of insurance - Ref. WR: ${w.id} - declared value ${money(w.declared)}`, amount: quote(w).customer }] : []),
  ];
  d.header([COMPANY.name, `${COMPANY.address}, ${COMPANY.city}`, COMPANY.phone]);
  d.text(`Invoice ${w.invoice ?? ""}`, 0, 20, { bold: true, color: BLUE, right: d.W - M }); d.y -= 30;
  const meta: [string, string][] = [["Invoice date", w.invoiceDate ?? w.date], ["Shipment ID", shipment || "-"], ["Receipt", wrCode(w)], ["Type", w.ship], ["Status", payStatus(w)], ["Representative", repOf(w.rep)?.initials ?? "-"]];
  meta.forEach(([k, v], i) => { const x = M + (CW / 3) * (i % 3), yy = d.y - Math.floor(i / 3) * 28; d.page.drawText(safe(k), { x, y: yy - 8, size: 8, font: d.font, color: GREY }); d.page.drawText(safe(v), { x, y: yy - 21, size: 10, font: d.bold, color: BLACK }); });
  d.y -= 62;
  const top = d.y;
  d.text("Bill To", M, 8.5, { color: GREY }); d.y -= 11; d.text(w.customer, M, 10.5, { bold: true }); d.y -= 14;
  for (const l of [c?.billing, w.email].filter(Boolean) as string[]) d.para(l, M, 240, 9.5);
  const left = d.y; d.y = top;
  d.text("Consignee", M + 270, 8.5, { color: GREY }); d.y -= 11; d.text(c?.consignee || w.customer, M + 270, 10.5, { bold: true }); d.y -= 14;
  d.text([c?.consigneeCity, c?.consigneeCountry].filter(Boolean).join(", "), M + 270, 9.5); d.y = Math.min(left, d.y - 12) - 8;
  if (w.comments) d.para(`Notes: ${w.comments}`, M, CW, 9.5, { gap: 4 });
  const cols = [{ w: CW - 190, t: "Description" }, { w: 55, t: "Qty", right: true }, { w: 65, t: "Rate", right: true }, { w: 70, t: "Amount", right: true }];
  d.row(cols, 9, { head: true });
  if (!lines.length) d.row([{ w: CW, t: "No fees on this receipt yet." }]);
  for (const l of lines) d.row([{ w: CW - 190, t: l.desc }, { w: 55, t: String(l.qty ?? "1.00"), right: true }, { w: 65, t: l.rate !== undefined ? money(l.rate) : money(Math.abs(l.amount)), right: true }, { w: 70, t: `${l.amount < 0 ? "-" : ""}${money(Math.abs(l.amount))}`, right: true }]);
  d.y -= 8;
  for (const [k, v, b] of [["Total", money(total(w)), true], ["Paid", money(paidAmt(w))], ["Balance", money(balance(w)), true]] as [string, string, boolean?][]) { d.need(16); d.text(k, d.W - M - 190, 10.5, { bold: !!b }); d.text(v, 0, 10.5, { bold: !!b, right: d.W - M }); d.y -= 16; }
  if (w.payments.length) { d.y -= 6; d.para("Payments received", M, CW, 9.5, { bold: true, gap: 1 }); for (const p of w.payments) d.row([{ w: CW - 90, t: `${p.date} - ${p.method}${p.ref ? ` - ${p.ref}` : ""}` }, { w: 90, t: money(p.amount), right: true }], 8.5); }
  if (balance(w) > 0) {
    const card = cardFees(balance(w)); d.y -= 8;
    d.para(`If paying the balance (${money(balance(w))}) by credit card: Square CC invoice ${money(card.invoice.total)} (fee ${money(card.invoice.fee)}) - card present ${money(card.present.total)} (fee ${money(card.present.fee)}) - manual ${money(card.manual.total)} (fee ${money(card.manual.fee)})`, M, CW, 8.5, { color: GREY });
  }
  d.y -= 8; d.para("Thank you for your business. Questions? Write to us or call " + COMPANY.phone + ".", M, CW, 9, { color: GREY });
  return d.bytes();
}
