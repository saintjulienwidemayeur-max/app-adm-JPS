// Automatic WhatsApp messages (through WaAPI, https://waapi.app): the same moments as the e-mails, as short texts.
// Nothing is stored in the code: the token and the instance come from the server's settings (Render environment variables):
//   WAAPI_TOKEN        the API token of WaAPI (Authorization: Bearer ...)
//   WAAPI_INSTANCE_ID  the id of the WhatsApp instance (optional: the first instance of the account is used when it is not set)
//   WAAPI_BASE_URL     optional, default https://waapi.app/api/v1
// Turned on in Administration > WhatsApp. A customer can be switched off on the customer's page. Every message is logged (E-mail history).
import { db, nowStr, timeNow, wrCode, total, money, toUSA, type WR, type Customer } from "./wh-store";
import { flush } from "./persist";
import { HAITI, COMPANY } from "./company";

export type WaEvent = "parcel" | "receipt" | "shipped" | "arrived" | "ready" | "invoice" | "order";
export const WA_EVENTS: { key: WaEvent; label: string }[] = [
  { key: "parcel", label: "Parcel received at the warehouse" }, { key: "receipt", label: "Warehouse receipt made or changed" },
  { key: "shipped", label: "Shipment left" }, { key: "arrived", label: "Arrived at the destination" }, { key: "ready", label: "Ready for pickup" }, { key: "invoice", label: "Invoice made" }, { key: "order", label: "Order invoice sent" },
];
type Lang = "fr" | "en" | "es";
const BASE = () => (process.env.WAAPI_BASE_URL ?? "https://waapi.app/api/v1").replace(/\/$/, "");
export const waConfigured = () => !!process.env.WAAPI_TOKEN;
export const waOn = (ev: WaEvent) => waConfigured() && db.settings.wa?.on === true && db.settings.wa.events?.[ev] !== false;

// A phone number as WhatsApp wants it: digits with the country code. 8 digits = Haiti (509), 10 digits = USA/Canada (1).
export function waNumber(raw: string, cc = db.settings.wa?.cc || "509"): string {
  const t = String(raw ?? "").trim(), plus = t.startsWith("+") || t.startsWith("00"), d = t.replace(/\D/g, "").replace(/^00/, "");
  if (!d) return "";
  if (plus) return d.length >= 8 && d.length <= 15 ? d : "";
  if (d.length === 8) return cc + d;
  if (d.length === 10) return "1" + d;
  if (d.length === 11 && d.startsWith("1")) return d;
  if (d.length === 11 && d.startsWith("509")) return d;
  return d.length >= 11 && d.length <= 15 ? d : "";
}
export const waNumberOf = (c: Pick<Customer, "phone" | "whatsapp" | "waOff"> | undefined) => (!c || c.waOff ? "" : waNumber(c.whatsapp || "") || waNumber(c.phone || ""));

async function call(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; json: unknown; raw: string }> {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(`${BASE()}${path}`, { ...init, signal: ctl.signal, headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${process.env.WAAPI_TOKEN}`, ...(init.headers ?? {}) } });
    const raw = await r.text(); let json: unknown = null; try { json = JSON.parse(raw); } catch { /* not JSON */ }
    return { ok: r.ok, status: r.status, json, raw };
  } finally { clearTimeout(timer); }
}
// WaAPI answers 200 with a nested "status": "error" for a failed send: look for it anywhere in the answer.
function problemIn(j: unknown): string {
  if (!j || typeof j !== "object") return "";
  const o = j as Record<string, unknown>;
  if (typeof o.status === "string" && /^(error|failed|fail)$/i.test(o.status)) return String(o.message ?? o.error ?? "the service answered with an error");
  if (o.error && typeof o.error === "string") return o.error;
  for (const v of Object.values(o)) { const p = problemIn(v); if (p) return p; }
  return "";
}
let instanceId: string | undefined;
async function instance(): Promise<{ id?: string; error?: string }> {
  const fixed = process.env.WAAPI_INSTANCE_ID?.trim();
  if (fixed) return { id: fixed };
  if (instanceId) return { id: instanceId };
  const r = await call("/instances");
  if (!r.ok) return { error: `could not list the instances (HTTP ${r.status}): ${r.raw.slice(0, 160)}` };
  const find = (v: unknown): string | undefined => { if (Array.isArray(v)) { for (const x of v) { const f = find(x); if (f) return f; } return undefined; } if (v && typeof v === "object") { const o = v as Record<string, unknown>; if ((typeof o.id === "number" || typeof o.id === "string") && ("owner" in o || "name" in o || "webhook_url" in o || "instanceId" in o || "isReady" in o)) return String(o.id); for (const x of Object.values(o)) { const f = find(x); if (f) return f; } } return undefined; };
  const id = find(r.json);
  if (!id) return { error: "no WhatsApp instance found in the account (create one in WaAPI, or set WAAPI_INSTANCE_ID)" };
  instanceId = id; return { id };
}
export type WaFile = { name: string; bytes: Uint8Array };
// One message now (with a PDF when `file` is given: the text is its caption). Returns an error text, or "" when WaAPI accepted it.
// If the PDF cannot be sent the text goes alone and the answer starts with "~" (sent, but without the PDF).
export async function waSendNow(number: string, text: string, file?: WaFile): Promise<{ error: string; raw: string }> {
  if (!waConfigured()) return { error: "WAAPI_TOKEN is not set on the server", raw: "" };
  if (!number) return { error: "no valid WhatsApp number", raw: "" };
  try {
    const ins = await instance();
    if (!ins.id) return { error: ins.error ?? "no instance", raw: "" };
    const base = `/instances/${encodeURIComponent(ins.id)}/client/action`, chatId = `${number}@c.us`;
    let pdfProblem = "";
    if (file) {
      const m = await call(`${base}/send-media`, { method: "POST", body: JSON.stringify({ chatId, mediaBase64: Buffer.from(file.bytes).toString("base64"), mediaName: file.name, mediaCaption: text, asDocument: true }) });
      const bad = !m.ok ? `HTTP ${m.status}: ${m.raw.slice(0, 160)}` : problemIn(m.json);
      if (!bad) return { error: "", raw: m.raw.slice(0, 400) };
      pdfProblem = bad;
    }
    const r = await call(`${base}/send-message`, { method: "POST", body: JSON.stringify({ chatId, message: text }) });
    const bad = !r.ok ? `HTTP ${r.status}: ${r.raw.slice(0, 160)}` : problemIn(r.json);
    return { error: bad ? bad : pdfProblem ? `~the PDF could not be sent: ${pdfProblem}` : "", raw: r.raw.slice(0, 400) };
  } catch (e) { return { error: e instanceof Error ? (e.name === "AbortError" ? "WaAPI did not answer in 15 seconds" : e.message) : String(e), raw: "" }; }
}
export const waFailed = (err: string) => !!err && !err.startsWith("~");
// The sentence the "Notify" button shows for the WhatsApp part.
export const waSay = (err: string) => (!err ? "WhatsApp sent (with the PDF where there is one)." : err.startsWith("~") ? `WhatsApp sent, but ${err.slice(1)}.` : `WhatsApp NOT sent (${err}).`);

// Messages go one after the other, a couple of seconds apart (WhatsApp does not like bursts), after the request that asked for them has answered.
const g = globalThis as unknown as { __waQ?: Promise<void> };
function queueWa(job: () => Promise<unknown>) {
  g.__waQ = (g.__waQ ?? Promise.resolve()).then(async () => { try { await job(); } catch (e) { console.error("[whatsapp]", e instanceof Error ? e.message : e); } await new Promise((r) => setTimeout(r, 2500)); await flush().catch(() => {}); });
}
function sendTo(c: Customer | undefined, text: string, what: string, file?: () => Promise<WaFile | undefined>) {
  const n = waNumberOf(c);
  if (!c || !n) return;
  queueWa(async () => {
    const f = file ? await file().catch(() => undefined) : undefined;
    const r = await waSendNow(n, text, f);
    db.maillog.unshift({ id: db.n.mail++, date: nowStr(), time: timeNow(), by: "whatsapp", subject: `[WhatsApp] ${what}${f ? " + PDF" : ""}`, to: `${c.name} (${n})`, sent: waFailed(r.error) ? 0 : 1, total: 1, failed: r.error ? [r.error.replace(/^~/, "PDF: ")] : [] });
    db.maillog.length = Math.min(db.maillog.length, 200);
  });
}

const langOf = (c: Pick<Customer, "lang"> | undefined): Lang => (c?.lang === "en" || c?.lang === "es" ? c.lang : "fr");
const AUTO: Record<Lang, string> = { fr: "Ceci est un message automatique.", en: "This is an automated message.", es: "Este es un mensaje automático." };
const SIGN = "JP's Logistics & More";
const bullets = (rows: [string, string][]) => rows.map(([k, v]) => `• ${k} : ${v}`).join("\n");
// Every message: greeting, a clear sentence, the details one per line, what to do next, "automated message", signature.
export function waText(kind: WaEvent, l: Lang, p: { name: string; code?: string; trackings?: string[]; pieces?: number; lbs?: number; total?: string; balance?: string; usa?: boolean; inv?: string; order?: string; ship?: string; withPdf?: boolean; payUrl?: string }): string {
  const usa = !!p.usa, code = p.code ?? "", n = p.trackings?.length ?? 1;
  const hi = { fr: `Bonjour ${p.name},`, en: `Hello ${p.name},`, es: `Hola ${p.name},` }[l];
  const where = usa ? { fr: "notre bureau d'Haïti", en: "our Haiti office", es: "nuestra oficina de Haití" }[l] : { fr: "notre entrepôt de Miami", en: "our Miami warehouse", es: "nuestro depósito de Miami" }[l];
  const dest = usa ? "Miami" : { fr: "Haïti", en: "Haiti", es: "Haití" }[l];
  const office = usa ? `${COMPANY.name}, ${COMPANY.address}, ${COMPANY.city}, ${COMPANY.phone}` : `${HAITI.name}, ${HAITI.address}, ${HAITI.city}, ${HAITI.phone}`;
  const list = (p.trackings ?? []).slice(0, 8).map((t) => `• ${t}`).join("\n") + ((p.trackings?.length ?? 0) > 8 ? "\n• ..." : "");
  const pdf = (what: string) => (p.withPdf ? { fr: `Vous trouverez ${what} en PDF ci-joint. Il a aussi été envoyé par e-mail.`, en: `You will find ${what} attached as a PDF. It was also sent to you by e-mail.`, es: `Encontrará ${what} adjunto en PDF. También se le envió por correo.` }[l] : { fr: `${what[0].toUpperCase()}${what.slice(1)} vous a été envoyé par e-mail.`, en: `${what[0].toUpperCase()}${what.slice(1)} was sent to you by e-mail.`, es: `${what[0].toUpperCase()}${what.slice(1)} se le envió por correo.` }[l]);
  const body: Record<WaEvent, string> = {
    parcel: { fr: `Bonne nouvelle : nous avons bien reçu ${n > 1 ? `vos ${n} colis` : "votre colis"} à ${where}.\n\n${list}\n\nIl${n > 1 ? "s seront" : " sera"} bientôt préparé${n > 1 ? "s" : ""} pour l'expédition.`, en: `Good news: we have received ${n > 1 ? `your ${n} parcels` : "your parcel"} at ${where}.\n\n${list}\n\nWe will prepare ${n > 1 ? "them" : "it"} for shipping soon.`, es: `Buenas noticias: recibimos ${n > 1 ? `sus ${n} paquetes` : "su paquete"} en ${where}.\n\n${list}\n\nPronto ${n > 1 ? "los" : "lo"} prepararemos para el envío.` }[l],
    receipt: { fr: `Votre reçu d'entrepôt ${code} est prêt.\n\n${bullets([["Nombre de pièces", String(p.pieces)], ["Poids total", `${p.lbs} lb`], ["Envoi", p.ship ?? ""], ["Total estimé", p.total ?? ""]])}\n\nLe prix final est confirmé sur la facture, après la douane.\n${pdf("le reçu")}`, en: `Your warehouse receipt ${code} is ready.\n\n${bullets([["Number of pieces", String(p.pieces)], ["Total weight", `${p.lbs} lb`], ["Shipping", p.ship ?? ""], ["Estimated total", p.total ?? ""]]).replace(/ : /g, ": ")}\n\nThe final price is confirmed on the invoice, after customs.\n${pdf("the receipt")}`, es: `Su recibo de almacén ${code} está listo.\n\n${bullets([["Número de piezas", String(p.pieces)], ["Peso total", `${p.lbs} lb`], ["Envío", p.ship ?? ""], ["Total estimado", p.total ?? ""]])}\n\nEl precio final se confirma en la factura, después de la aduana.\n${pdf("el recibo")}` }[l],
    shipped: { fr: `Votre colis (reçu ${code}) a quitté ${usa ? "Haïti" : "Miami"} et il est en route vers ${dest}.\n\nNous vous écrirons dès son arrivée.`, en: `Your parcel (receipt ${code}) has left ${usa ? "Haiti" : "Miami"} and is on its way to ${dest}.\n\nWe will write to you as soon as it arrives.`, es: `Su paquete (recibo ${code}) salió de ${usa ? "Haití" : "Miami"} y va en camino a ${dest}.\n\nLe escribiremos en cuanto llegue.` }[l],
    arrived: { fr: `Bonne nouvelle : votre colis (reçu ${code}) est arrivé en ${dest}.\n\nIl sera bientôt prêt pour le retrait ou la livraison. Nous vous prévenons dès qu'il est prêt.`, en: `Good news: your parcel (receipt ${code}) has arrived in ${dest}.\n\nIt will soon be ready for pickup or delivery. We will tell you as soon as it is ready.`, es: `Buenas noticias: su paquete (recibo ${code}) llegó a ${dest}.\n\nPronto estará listo para retirar o entregar. Le avisaremos en cuanto esté listo.` }[l],
    ready: { fr: `Votre colis (reçu ${code}) est prêt !\n\nVous pouvez venir le chercher (ou demander la livraison) à :\n${office}`, en: `Your parcel (receipt ${code}) is ready!\n\nYou can come and pick it up (or ask for delivery) at:\n${office}`, es: `¡Su paquete (recibo ${code}) está listo!\n\nPuede venir a retirarlo (o pedir la entrega) en:\n${office}` }[l],
    invoice: { fr: `Votre facture ${p.inv} est prête.\n\n${bullets([["Reçu", code], ["Total", p.total ?? ""], ["Reste à payer", p.balance ?? ""]])}\n\n${pdf("la facture")}${p.payUrl ? `\n\nPayer en ligne (carte, Apple Pay, Google Pay) :\n${p.payUrl}` : ""}`, en: `Your invoice ${p.inv} is ready.\n\n${bullets([["Receipt", code], ["Total", p.total ?? ""], ["Balance to pay", p.balance ?? ""]]).replace(/ : /g, ": ")}\n\n${pdf("the invoice")}${p.payUrl ? `\n\nPay online (card, Apple Pay, Google Pay):\n${p.payUrl}` : ""}`, es: `Su factura ${p.inv} está lista.\n\n${bullets([["Recibo", code], ["Total", p.total ?? ""], ["Saldo a pagar", p.balance ?? ""]])}\n\n${pdf("la factura")}` }[l],
    order: { fr: `La facture de votre commande ${p.order} est prête.\n\n${bullets([["Total", p.total ?? ""], ["Reste à payer", p.balance ?? ""]])}\n\n${pdf("la facture")}`, en: `The invoice for your order ${p.order} is ready.\n\n${bullets([["Total", p.total ?? ""], ["Balance to pay", p.balance ?? ""]]).replace(/ : /g, ": ")}\n\n${pdf("the invoice")}`, es: `La factura de su pedido ${p.order} está lista.\n\n${bullets([["Total", p.total ?? ""], ["Saldo a pagar", p.balance ?? ""]])}\n\n${pdf("la factura")}` }[l],
  };
  return `${hi}\n\n${body[kind]}\n\n${AUTO[l]}\n\n${SIGN}`;
}

// ---- the moments (called next to the e-mails) ----
type FileOf = () => Promise<WaFile | undefined>;
const shipOf = (w: WR, l: Lang) => (w.ship === "Air" ? { fr: "Par avion", en: "By air", es: "Por avión" }[l] : { fr: "Par bateau", en: "By ocean", es: "Por barco" }[l]);
const lbsOf = (w: WR) => Math.round(w.pieces.reduce((a, p) => a + p.lbs, 0) * 100) / 100;
const receiptText = (w: WR, c: Customer | undefined, withPdf: boolean) => { const l = langOf(c); return waText("receipt", l, { name: w.customer, code: wrCode(w), pieces: w.pieces.length, lbs: lbsOf(w), total: money(total(w)), ship: shipOf(w, l), withPdf }); };
const invoiceText = (w: WR, c: Customer | undefined, balance: number, withPdf: boolean, link = "") => waText("invoice", langOf(c), { name: w.customer, code: wrCode(w), inv: w.invoice, total: money(total(w)), balance: money(Math.max(0, balance)), withPdf, ...(balance > 0.004 && link && { payUrl: link }) });
export function waParcel(c: Customer | undefined, trackings: string[], usa = false) {
  if (!waOn("parcel") || !c || !trackings.length) return;
  sendTo(c, waText("parcel", langOf(c), { name: c.name, trackings, usa }), `parcel received (${trackings.length})`);
}
export function waStatus(w: WR, kind: "shipped" | "arrived" | "ready") {
  if (!waOn(kind)) return;
  const c = db.customers.find((x) => x.no === w.cust);
  sendTo(c, waText(kind, langOf(c), { name: w.customer, code: wrCode(w), usa: toUSA(w) }), `${kind} ${wrCode(w)}`);
}
export function waReceipt(w: WR, sig: string, file?: FileOf) {
  if (!waOn("receipt") || !w.pieces.length || w.waSig === sig) return;
  const c = db.customers.find((x) => x.no === w.cust);
  if (!waNumberOf(c)) return;
  w.waSig = sig;
  sendTo(c, receiptText(w, c, !!file), `receipt ${wrCode(w)}`, file);
}
export function waInvoice(w: WR, balance: number, file?: FileOf, link = "") {
  if (!waOn("invoice") || !w.invoice || w.waSig === w.invoice) return;
  const c = db.customers.find((x) => x.no === w.cust);
  if (!waNumberOf(c)) return;
  w.waSig = w.invoice;
  sendTo(c, invoiceText(w, c, balance, !!file, link), `invoice ${w.invoice}`, file);
}

// ---- the "Notify" button: e-mail AND WhatsApp together. The WhatsApp part is sent now and its answer is waited for. Returns "" when sent, "~..." when sent without the PDF, else the reason. ----
export async function waNotifyNow(c: Customer | undefined, text: string, what: string, file?: FileOf): Promise<string> {
  if (!waConfigured()) return "WhatsApp is not set up on the server (WAAPI_TOKEN)";
  if (db.settings.wa?.on !== true) return "WhatsApp is turned off (Administration > WhatsApp)";
  if (!c) return "no customer";
  if (c.waOff) return "WhatsApp is switched off for this customer";
  const n = waNumberOf(c);
  if (!n) return "the customer has no valid WhatsApp or phone number";
  const f = file ? await file().catch(() => undefined) : undefined;
  const r = await waSendNow(n, text, f);
  db.maillog.unshift({ id: db.n.mail++, date: nowStr(), time: timeNow(), by: "whatsapp", subject: `[WhatsApp] ${what}${f ? " + PDF" : ""} (button)`, to: `${c.name} (${n})`, sent: waFailed(r.error) ? 0 : 1, total: 1, failed: r.error ? [r.error.replace(/^~/, "PDF: ")] : [] });
  db.maillog.length = Math.min(db.maillog.length, 200);
  return r.error;
}
export async function waNowReceipt(w: WR, sig: string, file?: FileOf): Promise<string> {
  const c = db.customers.find((x) => x.no === w.cust);
  const err = await waNotifyNow(c, receiptText(w, c, !!file), `receipt ${wrCode(w)}`, file);
  if (!waFailed(err)) w.waSig = sig;
  return err;
}
export const waNowStatus = (w: WR, kind: "shipped" | "arrived" | "ready") => { const c = db.customers.find((x) => x.no === w.cust); return waNotifyNow(c, waText(kind, langOf(c), { name: w.customer, code: wrCode(w), usa: toUSA(w) }), `${kind} ${wrCode(w)}`); };
export const waNowInvoice = (w: WR, balance: number, file?: FileOf, link = "") => { const c = db.customers.find((x) => x.no === w.cust); return waNotifyNow(c, invoiceText(w, c, balance, !!file, link), `invoice ${w.invoice}`, file); };
export const waNowOrder = (c: Customer | undefined, id: string, totalText: string, balanceText: string, file?: FileOf) => waNotifyNow(c, waText("order", langOf(c), { name: c?.name ?? "", order: id, total: totalText, balance: balanceText, withPdf: !!file }), `order ${id}`, file);
