// E-mails that go out by themselves, nobody has to press anything:
//   - the warehouse receipt (PDF) when a piece is saved (after a short wait, so several pieces make one e-mail) and when the shipment ships;
//   - "your parcel arrived", "arrived in Haiti", "ready for pickup" for customers who have no account on the website (customers with an account
//     get these from the website: push + e-mail, see jps-sync.pushStatus);
//   - the invoice (PDF) is sent by the billing app when the invoice is made.
// Each e-mail is logged (Administration > Email customers > history) and the PDF that was sent is kept (wh_docs).
import { db, nowStr, timeNow, wrCode, wrSig, custOf, total, balance, paidAmt, money, toUSA, siteUSA, type WR, type Customer } from "./wh-store";
import { flush, saveDoc } from "./persist";
import { mailOne, mailTo, mailEnabled, findClientId, type MailFile } from "./jps-sync";
import { usableEmail } from "./mailrules";
import { receiptPdf } from "./pdf";
import { COMPANY, HAITI, PAY } from "./company";
import { waStatus, waReceipt } from "./whatsapp";
import { queueSiteReceipts } from "./site-receipts";

type Lang = "fr" | "en" | "es";
const langOf = (c?: Pick<Customer, "lang">): Lang => (c?.lang === "en" || c?.lang === "es" ? c.lang : "fr");

// One job at a time, after the request that asked for it has answered.
const g = globalThis as unknown as { __mailQ?: Promise<void>; __mailWait?: Map<string, ReturnType<typeof setTimeout>> };
export function queueMail(job: () => Promise<unknown>) {
  g.__mailQ = (g.__mailQ ?? Promise.resolve()).then(async () => { try { await job(); } catch (e) { console.error("[auto-mail]", e instanceof Error ? e.message : e); } finally { await flush().catch(() => {}); queueSiteReceipts(); } });
}
// A piece was saved: wait 2 minutes (more pieces for the same customer may follow), then send the receipt as it is by then.
export function queueReceiptSoon(wrId: string, seconds = Number(process.env.RECEIPT_MAIL_DELAY_SECONDS ?? 120)) {
  const waits = (g.__mailWait ??= new Map());
  clearTimeout(waits.get(wrId));
  waits.set(wrId, setTimeout(() => { waits.delete(wrId); const w = db.wrs.find((x) => x.id === wrId); if (w) queueMail(() => emailReceipt(w, "saved")); }, seconds * 1000));
  waits.get(wrId)?.unref?.();
}

const log = (subject: string, to: string, error?: string) => {
  db.maillog.unshift({ id: db.n.mail++, date: nowStr(), time: timeNow(), by: "automatic", subject, to, sent: error ? 0 : 1, total: 1, failed: error ? [error] : [] });
  db.maillog.length = Math.min(db.maillog.length, 200);
};
const FRIENDLY: Record<string, string> = { UNKNOWN_ACTION: "The website's admin-mail function is the old version: redeploy it (supabase-functions/admin-mail)." };

// Sends to the customer: through the website account if there is one, else to the e-mail on file. Returns an error text, or "" when sent.
async function deliver(c: Customer | undefined, fallbackEmail: string, subject: string, message: string, files: MailFile[]): Promise<{ error: string; to: string }> {
  if (!mailEnabled()) return { error: "E-mail is not set up (see Administration > Email customers).", to: "" };
  const own = c ? usableEmail(c) : undefined, email = own ?? (fallbackEmail && usableEmail({ email: fallbackEmail }) ? fallbackEmail : undefined);
  let clientId = c?.clientId;
  if (!clientId && c) for (const who of [c.box, own]) { if (!who) continue; const r = await findClientId(who); if (r.id) { clientId = r.id; break; } }
  if (clientId) { const e = await mailOne(clientId, subject, message, files); if (!e) return { error: "", to: email ?? c?.name ?? "" }; if (!email) return { error: FRIENDLY[e] ?? e, to: c?.name ?? "" }; }
  if (!email) return { error: "no usable e-mail (missing, shared or company address)", to: "" };
  const e = await mailTo({ email, name: c?.name, lang: langOf(c) }, subject, message, files);
  return { error: e ? FRIENDLY[e] ?? e : "", to: email };
}

const T = {
  fr: { rcptSubject: (n: string) => `Votre reçu d'entrepôt ${n}`, rcpt: (n: string, p: number, lbs: number, ship: string) => `Votre reçu ${n} est joint à ce message (PDF).\n\n${p} pièce${p > 1 ? "s" : ""}, ${lbs} lb · ${ship === "Ocean" ? "bateau" : "avion"}.`, est: (t: string) => `\n\nCeci est une ESTIMATION : total estimé ${t}. La facture finale est émise après le dédouanement et la livraison.`, fin: "\n\nLa facture finale est émise lorsque l'envoi a passé la douane et a été livré à notre bureau de destination.",
    arrMany: (n: number, l: string) => `Nous avons bien reçu vos ${n} colis dans notre entrepôt de Miami :\n${l}\n\nIls seront bientôt préparés pour l'expédition.`, arrSubject: "Votre colis est arrivé dans notre entrepôt de Miami", arr: (t: string) => `Nous avons bien reçu votre colis ${t} à notre entrepôt de Miami. Il sera bientôt préparé pour l'expédition.`,
    haitiSubject: (n: string) => `Vos colis du reçu ${n} sont arrivés en Haïti`, haiti: (n: string) => `Bonne nouvelle : tous les colis du reçu ${n} sont arrivés en Haïti. Nous vous prévenons dès qu'ils sont prêts pour le retrait.`,
    shippedSubject: (n: string) => `Votre envoi (reçu ${n}) est parti de Miami`, shipped: (n: string) => `Votre envoi du reçu ${n} vient de partir de Miami : il est en transit. Nous vous prévenons dès son arrivée en Haïti.`,
    readySubject: (n: string) => `Votre reçu ${n} est prêt pour le retrait`, ready: (n: string) => `Vos colis du reçu ${n} sont prêts pour le retrait / la livraison.\n\nVous pouvez passer à notre bureau : ${HAITI.name}, ${HAITI.address}, ${HAITI.city}, ${HAITI.phone}.` },
  en: { rcptSubject: (n: string) => `Your warehouse receipt ${n}`, rcpt: (n: string, p: number, lbs: number, ship: string) => `Your receipt ${n} is attached to this message (PDF).\n\n${p} piece${p > 1 ? "s" : ""}, ${lbs} lb · ${ship === "Ocean" ? "ocean" : "air"}.`, est: (t: string) => `\n\nThis is an ESTIMATE: estimated total ${t}. The final invoice is issued after customs and delivery.`, fin: "\n\nThe final invoice is issued when the shipment has cleared customs and been delivered to our destination office.",
    arrMany: (n: number, l: string) => `We received your ${n} packages at our Miami warehouse:\n${l}\n\nThey will soon be prepared for shipping.`, arrSubject: "Your package arrived at our Miami warehouse", arr: (t: string) => `We received your package ${t} at our Miami warehouse. It will soon be prepared for shipping.`,
    haitiSubject: (n: string) => `Your packages of receipt ${n} arrived in Haiti`, haiti: (n: string) => `Good news: all the packages of receipt ${n} arrived in Haiti. We will tell you as soon as they are ready for pickup.`,
    shippedSubject: (n: string) => `Your shipment (receipt ${n}) left Miami`, shipped: (n: string) => `Your shipment of receipt ${n} just left Miami: it is in transit. We will tell you as soon as it arrives in Haiti.`,
    readySubject: (n: string) => `Your receipt ${n} is ready for pickup`, ready: (n: string) => `Your packages of receipt ${n} are ready for pickup / delivery.\n\nYou can come to our office: ${HAITI.name}, ${HAITI.address}, ${HAITI.city}, ${HAITI.phone}.` },
  es: { rcptSubject: (n: string) => `Su recibo de almacén ${n}`, rcpt: (n: string, p: number, lbs: number, ship: string) => `Su recibo ${n} está adjunto a este mensaje (PDF).\n\n${p} pieza${p > 1 ? "s" : ""}, ${lbs} lb · ${ship === "Ocean" ? "barco" : "avión"}.`, est: (t: string) => `\n\nEsto es una ESTIMACIÓN: total estimado ${t}. La factura final se emite después de la aduana y la entrega.`, fin: "\n\nLa factura final se emite cuando el envío ha pasado la aduana y ha sido entregado en nuestra oficina de destino.",
    arrMany: (n: number, l: string) => `Recibimos sus ${n} paquetes en nuestro depósito de Miami:\n${l}\n\nPronto serán preparados para el envío.`, arrSubject: "Su paquete llegó a nuestro depósito de Miami", arr: (t: string) => `Recibimos su paquete ${t} en nuestro depósito de Miami. Pronto será preparado para el envío.`,
    haitiSubject: (n: string) => `Sus paquetes del recibo ${n} llegaron a Haití`, haiti: (n: string) => `Buenas noticias: todos los paquetes del recibo ${n} llegaron a Haití. Le avisaremos en cuanto estén listos para retirar.`,
    shippedSubject: (n: string) => `Su envío (recibo ${n}) salió de Miami`, shipped: (n: string) => `Su envío del recibo ${n} acaba de salir de Miami: está en tránsito. Le avisaremos en cuanto llegue a Haití.`,
    readySubject: (n: string) => `Su recibo ${n} está listo para retirar`, ready: (n: string) => `Sus paquetes del recibo ${n} están listos para retirar / entregar.\n\nPuede pasar por nuestra oficina: ${HAITI.name}, ${HAITI.address}, ${HAITI.city}, ${HAITI.phone}.` },
};

// Parcels that go from Haiti to the USA: received at the Haiti office, left Haiti, arrived in Miami, ready for pickup at the Miami warehouse.
const TU = {
  fr: { arrSubject: "Votre colis est arrivé à notre bureau d'Haïti", arr: (t: string) => `Nous avons bien reçu votre colis ${t} à notre bureau de Pétion-Ville (Haïti). Il sera bientôt préparé pour l'envoi vers les États-Unis.`, arrMany: (n: number, l: string) => `Nous avons bien reçu vos ${n} colis à notre bureau de Pétion-Ville (Haïti) :\n${l}\n\nIls seront bientôt préparés pour l'envoi vers les États-Unis.`,
    shippedSubject: (n: string) => `Votre envoi (reçu ${n}) est parti d'Haïti`, shipped: (n: string) => `Votre envoi du reçu ${n} vient de partir d'Haïti : il est en transit vers Miami. Nous vous prévenons dès son arrivée à Miami.`,
    haitiSubject: (n: string) => `Vos colis du reçu ${n} sont arrivés à Miami`, haiti: (n: string) => `Bonne nouvelle : tous les colis du reçu ${n} sont arrivés à Miami. Nous vous prévenons dès qu'ils sont prêts pour le retrait.`,
    readySubject: (n: string) => `Votre reçu ${n} est prêt pour le retrait à Miami`, ready: (n: string) => `Vos colis du reçu ${n} sont prêts pour le retrait à Miami.\n\nVous pouvez passer à notre entrepôt : ${COMPANY.name}, ${COMPANY.address}, ${COMPANY.city}, ${COMPANY.phone}.` },
  en: { arrSubject: "Your package arrived at our Haiti office", arr: (t: string) => `We received your package ${t} at our Pétion-Ville office (Haiti). It will soon be prepared for shipping to the USA.`, arrMany: (n: number, l: string) => `We received your ${n} packages at our Pétion-Ville office (Haiti):\n${l}\n\nThey will soon be prepared for shipping to the USA.`,
    shippedSubject: (n: string) => `Your shipment (receipt ${n}) left Haiti`, shipped: (n: string) => `Your shipment of receipt ${n} just left Haiti: it is in transit to Miami. We will tell you as soon as it arrives in Miami.`,
    haitiSubject: (n: string) => `Your packages of receipt ${n} arrived in Miami`, haiti: (n: string) => `Good news: all the packages of receipt ${n} arrived in Miami. We will tell you as soon as they are ready for pickup.`,
    readySubject: (n: string) => `Your receipt ${n} is ready for pickup in Miami`, ready: (n: string) => `Your packages of receipt ${n} are ready for pickup in Miami.\n\nYou can come to our warehouse: ${COMPANY.name}, ${COMPANY.address}, ${COMPANY.city}, ${COMPANY.phone}.` },
  es: { arrSubject: "Su paquete llegó a nuestra oficina de Haití", arr: (t: string) => `Recibimos su paquete ${t} en nuestra oficina de Pétion-Ville (Haití). Pronto será preparado para el envío a Estados Unidos.`, arrMany: (n: number, l: string) => `Recibimos sus ${n} paquetes en nuestra oficina de Pétion-Ville (Haití):\n${l}\n\nPronto serán preparados para el envío a Estados Unidos.`,
    shippedSubject: (n: string) => `Su envío (recibo ${n}) salió de Haití`, shipped: (n: string) => `Su envío del recibo ${n} acaba de salir de Haití: está en tránsito a Miami. Le avisaremos en cuanto llegue a Miami.`,
    haitiSubject: (n: string) => `Sus paquetes del recibo ${n} llegaron a Miami`, haiti: (n: string) => `Buenas noticias: todos los paquetes del recibo ${n} llegaron a Miami. Le avisaremos en cuanto estén listos para retirar.`,
    readySubject: (n: string) => `Su recibo ${n} está listo para retirar en Miami`, ready: (n: string) => `Sus paquetes del recibo ${n} están listos para retirar en Miami.\n\nPuede pasar por nuestro depósito: ${COMPANY.name}, ${COMPANY.address}, ${COMPANY.city}, ${COMPANY.phone}.` },
};

// The e-mail that goes with a warehouse receipt (PDF attached): the owner's model, in the customer's language.
export function receiptBody(w: WR, lang: Lang, name: string, code: string, pieces: number, lbs: number): string {
  const p = PAY, tot = money(total(w)), air = w.ship === "Air";
  if (lang === "fr") return `Dear ${name},

Merci d'avoir choisi JP's Logistics !
Le colis ci-joint, ${code}, a été reçu pour vous dans notre entrepôt et est en route vers sa destination.
${pieces} pièce${pieces > 1 ? "s" : ""}, ${lbs} lb, à expédier par ${air ? "avion" : "bateau"}.
Total estimé : ${tot}
La facture finale est émise lorsque l'envoi a passé la douane et a été livré à notre bureau de destination.
Nous acceptons les espèces ou un chèque à l'ordre de « ${p.checkTo} », à remettre lors de l'enlèvement ou de la livraison.
Pour les virements électroniques, veuillez utiliser l'une des méthodes suivantes :
${p.haiti.bank} : ${p.haiti.kind}
NOM : ${p.haiti.nameFr}
COMPTE GOURDES : ${p.haiti.gourdes}
COMPTE DOLLARS (USD) : ${p.haiti.usd}
- Zelle au : ${p.zelle}
- Pour les frais de traitement des paiements par carte de crédit, veuillez demander une facture en ligne.
- Virement bancaire local américain à :
${p.us.name}
Numéro de routage de ${p.us.bank} : ${p.us.routing}
Numéro de compte : ${p.us.account}
Heureux de vous compter parmi nos nombreux clients, nous espérons vous servir à nouveau très bientôt.
Cordialement,
JP's Logistics & More
${p.address}
Tél. : ${p.phone}`;
  if (lang === "es") return `Dear ${name},

¡Gracias por elegir JP's Logistics!
El envío adjunto, ${code}, fue recibido para usted en nuestro almacén y va en camino a su destino.
${pieces} pieza${pieces > 1 ? "s" : ""}, ${lbs} lb, a enviar por ${air ? "avión" : "barco"}.
Total estimado: ${tot}
La factura final se emite cuando el envío ha pasado la aduana y ha sido entregado en nuestra oficina de destino.
Aceptamos efectivo o un cheque a nombre de "${p.checkTo}", para entregar en el momento de la recogida o la entrega.
Para transferencias electrónicas, utilice uno de los siguientes métodos:
${p.haiti.bank}: CUENTA CORRIENTE
NOMBRE: ${p.haiti.name}
CUENTA EN GOURDES: ${p.haiti.gourdes}
CUENTA EN DÓLARES (USD): ${p.haiti.usd}
- Zelle a: ${p.zelle}
- Para los cargos de procesamiento de pagos con tarjeta de crédito, solicite una factura en línea.
- Transferencia bancaria local en EE. UU. a:
${p.us.name}
Número de ruta de ${p.us.bank}: ${p.us.routing}
Número de cuenta: ${p.us.account}
Nos alegra contarle entre nuestros muchos clientes y esperamos volver a atenderle muy pronto.
Atentamente,
JP's Logistics & More
${p.address}
Tel.: ${p.phone}`;
  return `Dear ${name},

Thank you for choosing JP's Logistics!
The attached shipment, ${code}, was received for you in our warehouse and is on the way to destination.
${pieces} piece${pieces > 1 ? "s" : ""}, ${lbs} lbs instructed to be shipped by ${air ? "air" : "ocean"}.
Estimated Total: ${tot}
The final invoice is issued when the shipment has cleared customs and been delivered to our destination office.
We accept cash or a check made to the order of "${p.checkTo}" ready to remit at the time of pickup or delivery.
For electronic transfers, please use one of the following methods:
${p.haiti.bank}: CHECKING ACCOUNT (COMPTE COURANT)
NAME: ${p.haiti.name}
GOURDES ACCOUNT: ${p.haiti.gourdes}
DOLLARS ACCOUNT (USD): ${p.haiti.usd}
- Zelle to: ${p.zelle}
- For credit card payment processing fees, please ask for an online invoice.
- US local wire transfer to:
${p.us.name}
${p.us.bank} routing number: ${p.us.routing}
Account number: ${p.us.account}
Happy that you are one of our many customers and look forward to serving you again soon.
Yours truly,
JP's Logistics & More
${p.address}
Tel.: ${p.phone}`;
}

// The warehouse receipt as a PDF. Not sent twice for the same state of the receipt.
// `force` (the "Notify by e-mail" button) sends again even if the same state was already sent. Returns an error text, or "" when sent.
export async function emailReceipt(w: WR, why: string, force = false): Promise<string> {
  if (!w.pieces.length) return "The receipt has no pieces yet.";
  const sig = wrSig(w);
  if (!force && w.notices?.some((n) => n.auto && n.channel === "Email" && n.sig === sig)) return "";
  if (!force) waReceipt(w, sig, async () => ({ name: `Receipt-${wrCode(w)}.pdf`, bytes: await receiptPdf(w) })); // WhatsApp (short text) even when there is no usable e-mail
  const c = custOf(w), tx = T[langOf(c)], code = wrCode(w);
  const lbs = Math.round(w.pieces.reduce((a, p) => a + p.lbs, 0) * 100) / 100;
  const pdf = await receiptPdf(w), name = `Receipt-${code}.pdf`;
  const message = receiptBody(w, langOf(c), c?.name ?? w.customer, code, w.pieces.length, lbs);
  const r = await deliver(c, w.email, tx.rcptSubject(code), message, [{ name, content: Buffer.from(pdf).toString("base64") }]);
  log(tx.rcptSubject(code), r.to || w.customer, r.error || undefined);
  if (r.error) return r.error;
  const doc = await saveDoc({ kind: "receipt", ref: w.id, name, note: `${why} · sent to ${r.to}`, data: pdf });
  (w.notices ??= []).push({ date: nowStr(), time: timeNow(), channel: "Email", sig, auto: true, to: r.to, doc, why });
  return "";
}

const hasAccount = (w: WR) => !!custOf(w)?.clientId || db.items.some((i) => i.wr === w.id && i.clientId);
// "Parcel arrived": only for a customer with no account (the website sends it to the others).
export function emailParcelArrived(c: Customer | undefined, trackings: string[], office?: "Haiti") {
  if (!c || (c.clientId && !office) || !usableEmail(c) || !trackings.length) return; // received in Haiti: the website does not send it, so always from here
  const tx = office ? TU[langOf(c)] : T[langOf(c)], tracking = trackings.join(", "), one = trackings.length === 1;
  queueMail(async () => { const r = await deliver(c, "", tx.arrSubject, one ? tx.arr(tracking) : tx.arrMany(trackings.length, trackings.join("\n")), []); log(tx.arrSubject, r.to || c.name, r.error || undefined); });
}
export function emailHaiti(w: WR, kind: "shipped" | "arrived" | "ready") {
  waStatus(w, kind); // WhatsApp, whatever the e-mail does
  const c = custOf(w);
  if ((hasAccount(w) && (!toUSA(w) || siteUSA())) || !c || !usableEmail(c)) return; // cargo to Miami: from here, unless the website knows that direction
  queueMail(() => emailStatus(w, kind));
}
// The same e-mail on demand ("Notify by e-mail" button): sent even if the customer has a website account. Returns an error text, or "".
export async function emailStatus(w: WR, kind: "shipped" | "arrived" | "ready"): Promise<string> {
  const c = custOf(w);
  const tx = (toUSA(w) ? TU : T)[langOf(c)], code = wrCode(w), subject = kind === "ready" ? tx.readySubject(code) : kind === "shipped" ? tx.shippedSubject(code) : tx.haitiSubject(code), message = kind === "ready" ? tx.ready(code) : kind === "shipped" ? tx.shipped(code) : tx.haiti(code);
  const r = await deliver(c, w.email, subject, message, []);
  log(subject, r.to || c?.name || w.customer, r.error || undefined);
  return r.error;
}
