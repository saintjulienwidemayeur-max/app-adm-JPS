// PDF of the warehouse receipt and of the invoice (the same content as the printed pages), made on the server so it can be e-mailed and kept.
// pdf-lib draws with the standard PDF fonts: only Latin-1 text, anything else is replaced (see `safe`).
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { DISCLAIMER, ESTIMATE_NOTE } from "./disclaimer";
import { COMPANY, HAITI, PAY } from "./company";
import { cardFees } from "./pricing";
import { db, totalMeasure, vol, cuft, chargeable, r2, charges, credits, quote, insuranceFee, total, paidAmt, balance, payStatus, money, wrCode, docLines, custOf, shipperOf, receiverOf, toUSA, freightFee, freightQty, freightDesc, contentsOf, repOf, type WR } from "./wh-store";

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
  const sh = shipperOf(w), rc = receiverOf(w), consignee = rc.name, place = [c?.consigneeCity, c?.consigneeCountry].filter(Boolean).join(", "), phone = rc.phone;
  const office = toUSA(w) ? HAITI : COMPANY; // received at the Haiti office when it goes to the USA
  d.header([longDate(w.date), COMPANY.name, `${office.address}, ${office.city}`, office.phone]);
  d.y -= 4; d.text("Warehouse Receipt", 0, 20, { bold: true, right: d.W / 2 + d.width("Warehouse Receipt", 20, true) / 2 }); d.y -= 30;
  const top = d.y;
  d.text("Shipper", M, 9, { color: GREY }); d.text(`${sh.name} (customer ${w.cust})`, M + 48, 10, { bold: true }); d.y -= 14;
  if (sh.phone) d.para(`Phone ${sh.phone}`, M, 300, 9.5);
  if (c?.billing) d.para(c.billing, M, 300, 9.5);
  d.y -= 4; d.text("Consignee", M, 9, { color: GREY }); d.text(consignee, M + 48, 10, { bold: true }); d.y -= 14;
  for (const l of [rc.address, place, phone && `Phone ${phone}`, w.email && `eMail ${w.email}`].filter(Boolean) as string[]) d.para(l, M, 300, 9.5);
  const afterLeft = d.y; d.y = top;
  d.page.drawRectangle({ x: d.W - M - 150, y: d.y - 34, width: 150, height: 34, borderColor: GREY, borderWidth: 1.5 });
  d.text("WR #", 0, 9, { color: GREY, right: d.W - M - 150 + 38 }); d.page.drawText(safe(wrCode(w)), { x: d.W - M - 108, y: d.y - 23, size: 15, font: d.bold, color: BLACK });
  d.y -= 44; d.text(`Ship Type: ${w.ship}   Type: ${w.kind ?? "Personal"}${w.dest ? `   To: ${w.dest}` : ""}${w.route ? `   Route: ${w.route}` : ""}`, 0, 9.5, { right: d.W - M }); d.y = Math.min(afterLeft, d.y - 14) - 10;
  // pieces
  const cols = [{ w: 48, t: "Item #" }, { w: 215, t: "Description" }, { w: 55, t: "Weight", right: true }, { w: 45, t: "CUFT", right: true }, { w: CW - 363, t: "Contents" }];
  d.row(cols, 9, { head: true });
  w.pieces.forEach((p, i) => d.row([{ w: 48, t: String(p.no) }, { w: 215, t: `${p.type} - (in) L${p.l} X W${p.w} X H${p.h} - ${vol(p)} lbs*` }, { w: 55, t: String(p.lbs), right: true }, { w: 45, t: String(cuft(p)), right: true }, { w: CW - 363, t: p.contents ?? (i === 0 ? w.contents : "") }]));
  d.y -= 8; d.need(70);
  const gross = r2(w.pieces.reduce((a, p) => a + p.lbs, 0)), cf = r2(w.pieces.reduce((a, p) => a + cuft(p), 0)), chg = r2(w.pieces.reduce((a, p) => a + chargeable(p), 0));
  const stats: [string, string][] = [["Total Pieces", String(w.pieces.length)], ["Gross Weight", `${gross} lbs`], ["Total Cubic ft", `${cf} cuft`], ["Total Chargeable", `${chg} lbs`]];
  stats.forEach(([k, v], i) => { const x = M + (CW / 4) * i; d.page.drawText(safe(k), { x, y: d.y - 9, size: 8.5, font: d.bold, color: GREY }); d.page.drawText(safe(v), { x, y: d.y - 24, size: 12, font: i === 3 ? d.bold : d.font, color: BLACK }); });
  d.y -= 34; d.rule(M, d.W - M, 1.4, BLACK); d.y -= 8;
  d.text("Declared Contents", M, 9.5, { bold: true }); d.text(`Value of the parcel ${money(w.declared)}`, 0, 9.5, { bold: true, right: d.W - M }); d.y -= 14;
  d.para(contentsOf(w) || "-", M, CW, 9.5, { gap: 4 });
  d.para(w.insurance === "Declined" ? "CUSTOMER DECLINED INSURANCE COVERAGE" : w.declared > 0 ? `INSURANCE ACCEPTED - declared value ${money(w.declared)}` : "INSURANCE ACCEPTED (no declared value)", M, CW, 10, { bold: true, gap: 2 });
  if (w.comments) d.para(`Comments: ${w.comments}`, M, CW, 9.5, { gap: 4 });
  // Charges and credits on every receipt (not only estimates): the same lines as the invoice.
  {
    d.y -= 4; d.para(w.estimate ? "Estimate" : "Charges and credits", M, CW, 13, { bold: true, color: BLUE, gap: 2 });
    const dl = docLines(w);
    if (!dl.length) d.para("No fees on this receipt yet.", M, CW, 9, { color: GREY, gap: 2 });
    for (const l of dl) d.row([{ w: CW - 90, t: l.qty !== undefined ? `${l.desc} (${l.qty} x ${money(l.rate ?? 0)})` : l.desc }, { w: 90, t: `${l.amount < 0 ? "-" : ""}${money(Math.abs(l.amount))}`, right: true }], 9);
    d.y -= 4;
    const sum: [string, string, boolean?][] = [[totalMeasure(w).label, totalMeasure(w).value, true]];
    if (credits(w) > 0) sum.push(["Charges", money(charges(w) + insuranceFee(w))], ["Credits", `-${money(credits(w))}`]);
    sum.push([w.estimate ? "Estimated total" : "Total", money(total(w)), true], ["Paid", money(paidAmt(w))], ["Balance", money(balance(w))], ["Status", payStatus(w)]);
    for (const [k, v, b] of sum) { d.need(14); d.text(k, d.W - M - 190, 10, { bold: !!b }); d.text(v, 0, 10, { bold: !!b, right: d.W - M }); d.y -= 14; }
    if (balance(w) > 0) { const card = cardFees(balance(w)); d.y -= 4; d.para(`If paying with a credit card (3% + $0.30 fee): ${money(card.invoice.total)}`, M, CW, 9, { gap: 2 }); }
    if (w.estimate) d.para(ESTIMATE_NOTE, M, CW, 8.5, { gap: 4 });
    else d.para("This receipt confirms what JP's received. The final invoice is issued when the shipment has cleared customs and been delivered to our destination office.", M, CW, 8.5, { color: GREY, gap: 4 });
  }
  d.y -= 6; d.need(30); d.text("THANK YOU FOR YOUR BUSINESS", 0, 13, { bold: true, color: GREY, right: d.W / 2 + d.width("THANK YOU FOR YOUR BUSINESS", 13, true) / 2 }); d.y -= 22;
  d.para("***** Disclaimer *****", M, CW, 10, { bold: true, color: GREY, gap: 2 });
  for (const t of DISCLAIMER) d.para("- " + t, M, CW, 7.6, { color: GREY });
  return d.bytes();
}

// ---------- Invoice ----------
export async function invoicePdf(w: WR): Promise<Uint8Array> {
  const d = await Doc.make(), c = custOf(w), M = d.M, CW = d.W - 2 * M, R = d.W - M;
  const lbs = r2(w.pieces.reduce((a, p) => a + p.lbs, 0));
  const shipment = db.loads.find((l) => l.wr === w.id)?.shipment ?? "";
  const lines = docLines(w), top = d.H - M;
  // Top: the title on the left, the logo on the right, the invoice number, date, terms and rep under the logo.
  if (d.logo) { const lw = 120, lh = (lw * d.logo.height) / d.logo.width; d.page.drawImage(d.logo, { x: R - lw, y: top - lh, width: lw, height: lh }); d.y = top - lh - 14; } else d.y = top - 40;
  d.page.drawText("INVOICE", { x: M + 5, y: d.y - 40, size: 22, font: d.bold, color: BLUE });
  const meta: [string, string][] = [["INVOICE #", w.invoice ?? ""], ["DATE", w.invoiceDate ?? w.date], ["Terms", "Other"], ["Rep", w.rep || c?.rep || ""]];
  meta.forEach(([k, v], i) => { const yy = d.y - i * 16; d.page.drawText(safe(k), { x: 330, y: yy - 10, size: 10, font: d.bold }); d.page.drawText(safe(v), { x: 415, y: yy - 10, size: 10, font: d.font, color: i === 3 ? GREY : BLACK }); });
  d.y -= 80;
  // Two boxes: Bill To and Consignee.
  const bh = 92, bw = (CW - 20) / 2, by = d.y;
  const box = (x: number, title: string, lines2: string[]) => {
    d.page.drawRectangle({ x, y: by - bh, width: bw, height: bh, borderColor: rgb(0.45, 0.45, 0.5), borderWidth: 0.8 });
    d.page.drawText(safe(title), { x: x + 5, y: by - 14, size: 10, font: d.bold });
    let yy = by - 28;
    for (const l of lines2) for (const ln of d.wrap(l, bw - 12, 8.5)) { if (yy < by - bh + 6) break; d.page.drawText(ln, { x: x + 5, y: yy, size: 8.5, font: d.font, color: GREY }); yy -= 11.5; }
  };
  const rc = receiverOf(w);
  box(M, "BILL TO", [w.customer, c?.billing ?? ""].filter(Boolean));
  box(M + bw + 20, "CONSIGNEE", toUSA(w) ? [rc.name, rc.address, rc.phone] : [rc.name, [c?.consigneeCity, c?.consigneeCountry].filter(Boolean).join(", "), rc.phone, w.email].filter(Boolean));
  d.y = by - bh - 14;
  // The lines: Details, Qty, Rate, Amount.
  const cols = [{ w: CW - 190, t: "Details" }, { w: 55, t: "Qty", right: true }, { w: 65, t: "Rate", right: true }, { w: 70, t: "", right: true }];
  d.row(cols, 9, { head: true, border: false });
  if (!lines.length) d.row([{ w: CW, t: "No fees on this receipt yet." }], 9, { border: false });
  for (const l of lines) d.row([{ w: CW - 190, t: l.desc.includes("Ref. WR") ? l.desc : `${l.desc}` }, { w: 55, t: String(l.qty ?? "1.00"), right: true }, { w: 65, t: l.rate !== undefined ? money(l.rate) : money(Math.abs(l.amount)), right: true }, { w: 70, t: money(l.amount), right: true }], 9, { border: false });
  d.y -= 2; d.rule(M, R, 1.6, BLUE); d.y -= 10;
  // The three totals, blue labels and a box for each amount.
  for (const [k, v] of [["INVOICE AMOUNT", money(total(w))], ["PAYMENT RECEIVED OR CREDIT APPLIED", money(paidAmt(w))], ["AMOUNT DUE", money(balance(w))]]) {
    d.need(22);
    d.page.drawText(k, { x: R - 90 - 8 - d.bold.widthOfTextAtSize(k, 8.5), y: d.y - 12, size: 8.5, font: d.bold, color: rgb(0.1, 0.25, 0.9) });
    d.page.drawRectangle({ x: R - 90, y: d.y - 17, width: 90, height: 18, color: rgb(0.97, 0.97, 0.98) });
    d.page.drawText(v, { x: R - 6 - d.font.widthOfTextAtSize(v, 9), y: d.y - 12, size: 9, font: d.font });
    d.y -= 24;
  }
  void lbs;
  // The foot of the page: how to pay, the pick-up address, a QR code to pay online, the shipment name.
  const fy = 150; let yy = fy;
  const small = (s: string, x: number, bold = false, size = 6.5) => { d.page.drawText(safe(s), { x, y: yy, size, font: bold ? d.bold : d.font }); yy -= 8.6; };
  small("Payment Options", M, false, 6.5);
  small(`•  Make Check payable to '${PAY.checkTo}'`, M + 4);
  small(`•  Zelle to ${PAY.zelle}`, M + 4);
  small("•  For Credit Card Payment process fees applies, please, ask for a payment link", M + 4);
  small("•  Local Wire Transfer to:", M + 4);
  small(`${PAY.us.name} \\ ${PAY.us.bank}`, M + 22); small(`Routing: ${PAY.us.routing} \\ Account: ${PAY.us.account}`, M + 22);
  small(`Pick Up address: ${HAITI.address}, ${HAITI.city}`, M); small(`Phone: ${HAITI.phone}`, M);
  small("Thank You for your business!", M, true); small("JP's Logistics And More", M, true);
  
  if (shipment) d.page.drawText(safe(shipment), { x: R - d.bold.widthOfTextAtSize(safe(shipment), 7.5), y: 55, size: 7.5, font: d.bold });
  return d.bytes();
}
