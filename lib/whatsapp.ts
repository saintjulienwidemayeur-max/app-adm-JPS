// Automatic WhatsApp messages (through WaAPI, https://waapi.app): the same moments as the e-mails, as short texts.
// Nothing is stored in the code: the token and the instance come from the server's settings (Render environment variables):
//   WAAPI_TOKEN        the API token of WaAPI (Authorization: Bearer ...)
//   WAAPI_INSTANCE_ID  the id of the WhatsApp instance (optional: the first instance of the account is used when it is not set)
//   WAAPI_BASE_URL     optional, default https://waapi.app/api/v1
// Turned on in Administration > WhatsApp. A customer can be switched off on the customer's page. Every message is logged (E-mail history).
import { db, nowStr, timeNow, wrCode, total, money, toUSA, type WR, type Customer } from "./wh-store";
import { flush } from "./persist";
import { HAITI, COMPANY } from "./company";

export type WaEvent = "parcel" | "receipt" | "shipped" | "arrived" | "ready" | "invoice";
export const WA_EVENTS: { key: WaEvent; label: string }[] = [
  { key: "parcel", label: "Parcel received at the warehouse" }, { key: "receipt", label: "Warehouse receipt made or changed" },
  { key: "shipped", label: "Shipment left" }, { key: "arrived", label: "Arrived at the destination" }, { key: "ready", label: "Ready for pickup" }, { key: "invoice", label: "Invoice made" },
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
// One message now. Returns an error text, or "" when WaAPI accepted it.
export async function waSendNow(number: string, text: string): Promise<{ error: string; raw: string }> {
  if (!waConfigured()) return { error: "WAAPI_TOKEN is not set on the server", raw: "" };
  if (!number) return { error: "no valid WhatsApp number", raw: "" };
  try {
    const ins = await instance();
    if (!ins.id) return { error: ins.error ?? "no instance", raw: "" };
    const r = await call(`/instances/${encodeURIComponent(ins.id)}/client/action/send-message`, { method: "POST", body: JSON.stringify({ chatId: `${number}@c.us`, message: text }) });
    const bad = !r.ok ? `HTTP ${r.status}: ${r.raw.slice(0, 160)}` : problemIn(r.json);
    return { error: bad, raw: r.raw.slice(0, 400) };
  } catch (e) { return { error: e instanceof Error ? (e.name === "AbortError" ? "WaAPI did not answer in 15 seconds" : e.message) : String(e), raw: "" }; }
}

// Messages go one after the other, a couple of seconds apart (WhatsApp does not like bursts), after the request that asked for them has answered.
const g = globalThis as unknown as { __waQ?: Promise<void> };
function queueWa(job: () => Promise<unknown>) {
  g.__waQ = (g.__waQ ?? Promise.resolve()).then(async () => { try { await job(); } catch (e) { console.error("[whatsapp]", e instanceof Error ? e.message : e); } await new Promise((r) => setTimeout(r, 2500)); await flush().catch(() => {}); });
}
function sendTo(c: Customer | undefined, text: string, what: string) {
  const n = waNumberOf(c);
  if (!c || !n) return;
  queueWa(async () => {
    const r = await waSendNow(n, text);
    db.maillog.unshift({ id: db.n.mail++, date: nowStr(), time: timeNow(), by: "whatsapp", subject: `[WhatsApp] ${what}`, to: `${c.name} (${n})`, sent: r.error ? 0 : 1, total: 1, failed: r.error ? [r.error] : [] });
    db.maillog.length = Math.min(db.maillog.length, 200);
  });
}

const langOf = (c: Pick<Customer, "lang"> | undefined): Lang => (c?.lang === "en" || c?.lang === "es" ? c.lang : "fr");
const sign = (l: Lang) => ({ fr: "JP's Logistics & More", en: "JP's Logistics & More", es: "JP's Logistics & More" }[l]);
export function waText(kind: WaEvent, l: Lang, p: { name: string; code?: string; trackings?: string[]; pieces?: number; lbs?: number; total?: string; balance?: string; usa?: boolean; inv?: string; ship?: string }): string {
  const hi = { fr: `Bonjour ${p.name},`, en: `Hello ${p.name},`, es: `Hola ${p.name},` }[l], usa = !!p.usa, code = p.code ?? "";
  const office = usa ? { fr: "notre bureau d'Haïti", en: "our Haiti office", es: "nuestra oficina de Haití" }[l] : { fr: "notre entrepôt de Miami", en: "our Miami warehouse", es: "nuestro depósito de Miami" }[l];
  const dest = usa ? "Miami" : { fr: "Haïti", en: "Haiti", es: "Haití" }[l];
  const T: Record<WaEvent, Record<Lang, string>> = {
    parcel: { fr: `Nous avons reçu ${(p.trackings?.length ?? 1) > 1 ? `vos ${p.trackings!.length} colis` : "votre colis"} à ${office} : ${(p.trackings ?? []).slice(0, 5).join(", ")}${(p.trackings?.length ?? 0) > 5 ? "..." : ""}.`, en: `We received your ${(p.trackings?.length ?? 1) > 1 ? `${p.trackings!.length} parcels` : "parcel"} at ${office}: ${(p.trackings ?? []).slice(0, 5).join(", ")}${(p.trackings?.length ?? 0) > 5 ? "..." : ""}.`, es: `Recibimos ${(p.trackings?.length ?? 1) > 1 ? `sus ${p.trackings!.length} paquetes` : "su paquete"} en ${office}: ${(p.trackings ?? []).slice(0, 5).join(", ")}${(p.trackings?.length ?? 0) > 5 ? "..." : ""}.` },
    receipt: { fr: `Votre reçu d'entrepôt ${code} est prêt : ${p.pieces} pièce(s), ${p.lbs} lb, ${p.ship}. Total estimé : ${p.total}. Le PDF vous a été envoyé par e-mail.`, en: `Your warehouse receipt ${code} is ready: ${p.pieces} piece(s), ${p.lbs} lb, ${p.ship}. Estimated total: ${p.total}. The PDF was sent to you by e-mail.`, es: `Su recibo de almacén ${code} está listo: ${p.pieces} pieza(s), ${p.lbs} lb, ${p.ship}. Total estimado: ${p.total}. El PDF se le envió por correo.` },
    shipped: { fr: `Votre envoi (reçu ${code}) est parti : il est en transit vers ${dest}. Nous vous prévenons dès son arrivée.`, en: `Your shipment (receipt ${code}) has left: it is in transit to ${dest}. We will tell you as soon as it arrives.`, es: `Su envío (recibo ${code}) salió: va en tránsito a ${dest}. Le avisaremos en cuanto llegue.` },
    arrived: { fr: `Bonne nouvelle : votre envoi (reçu ${code}) est arrivé en ${dest}. Il sera bientôt prêt pour le retrait.`, en: `Good news: your shipment (receipt ${code}) has arrived in ${dest}. It will soon be ready for pickup.`, es: `Buenas noticias: su envío (recibo ${code}) llegó a ${dest}. Pronto estará listo para retirar.` },
    ready: { fr: `Votre envoi (reçu ${code}) est prêt pour le retrait / la livraison. ${usa ? `${COMPANY.name}, ${COMPANY.address}, ${COMPANY.city}, ${COMPANY.phone}` : `${HAITI.name}, ${HAITI.address}, ${HAITI.city}, ${HAITI.phone}`}`, en: `Your shipment (receipt ${code}) is ready for pickup / delivery. ${usa ? `${COMPANY.name}, ${COMPANY.address}, ${COMPANY.city}, ${COMPANY.phone}` : `${HAITI.name}, ${HAITI.address}, ${HAITI.city}, ${HAITI.phone}`}`, es: `Su envío (recibo ${code}) está listo para retiro / entrega. ${usa ? `${COMPANY.name}, ${COMPANY.address}, ${COMPANY.city}, ${COMPANY.phone}` : `${HAITI.name}, ${HAITI.address}, ${HAITI.city}, ${HAITI.phone}`}` },
    invoice: { fr: `Votre facture ${p.inv} (reçu ${code}) : total ${p.total}, solde à payer ${p.balance}. Elle vous a été envoyée par e-mail.`, en: `Your invoice ${p.inv} (receipt ${code}): total ${p.total}, balance to pay ${p.balance}. It was sent to you by e-mail.`, es: `Su factura ${p.inv} (recibo ${code}): total ${p.total}, saldo a pagar ${p.balance}. Se le envió por correo.` },
  };
  return `${hi}\n${T[kind][l]}\n\n${sign(l)}`;
}

// ---- the moments (called next to the e-mails) ----
export function waParcel(c: Customer | undefined, trackings: string[], usa = false) {
  if (!waOn("parcel") || !c || !trackings.length) return;
  sendTo(c, waText("parcel", langOf(c), { name: c.name, trackings, usa }), `parcel received (${trackings.length})`);
}
export function waStatus(w: WR, kind: "shipped" | "arrived" | "ready") {
  if (!waOn(kind)) return;
  const c = db.customers.find((x) => x.no === w.cust);
  sendTo(c, waText(kind, langOf(c), { name: w.customer, code: wrCode(w), usa: toUSA(w) }), `${kind} ${wrCode(w)}`);
}
export function waReceipt(w: WR, sig: string) {
  if (!waOn("receipt") || !w.pieces.length || w.waSig === sig) return;
  const c = db.customers.find((x) => x.no === w.cust);
  if (!waNumberOf(c)) return;
  w.waSig = sig;
  const lbs = Math.round(w.pieces.reduce((a, p) => a + p.lbs, 0) * 100) / 100;
  sendTo(c, waText("receipt", langOf(c), { name: w.customer, code: wrCode(w), pieces: w.pieces.length, lbs, total: money(total(w)), ship: w.ship === "Air" ? { fr: "avion", en: "air", es: "avión" }[langOf(c)] : { fr: "bateau", en: "ocean", es: "barco" }[langOf(c)] }), `receipt ${wrCode(w)}`);
}
export function waInvoice(w: WR, balance: number) {
  if (!waOn("invoice") || !w.invoice || w.waSig === w.invoice) return;
  const c = db.customers.find((x) => x.no === w.cust);
  if (!waNumberOf(c)) return;
  w.waSig = w.invoice;
  sendTo(c, waText("invoice", langOf(c), { name: w.customer, code: wrCode(w), inv: w.invoice, total: money(total(w)), balance: money(Math.max(0, balance)) }), `invoice ${w.invoice}`);
}
