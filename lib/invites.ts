// Invitations to the customer website: open the customer's account (with a temporary password) and write to them. Server only.
import { randomInt } from "node:crypto";
import { db, nowStr, timeNow, type Customer } from "./wh-store";
import { usableEmail } from "./mailrules";
import { siteClients, siteSignup, siteResetPassword, siteSetLang, mailOne, siteAccountStats, mailEnabled, syncEnabled, mailSetupProblem } from "./jps-sync";
import { COMPANY } from "./company";
import { daysSince } from "./clock";

export const INVITES_PER_DAY = 100;
export const REMIND_AFTER_DAYS = 7, MAX_INVITES_PER_CUSTOMER = 3;
export const SITE = "https://jpslogistics.me";

// A temporary password: easy to read (no 0/O, 1/l/I), 10 characters, from a secure random source.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
export const tempPassword = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

type Lang = "fr" | "en" | "es";
const langOf = (c: Customer): Lang => (c.lang === "en" || c.lang === "es" ? c.lang : "fr");

// The e-mail the customer gets. The website adds "Hello <full name>," before and the team signature after.
export function inviteMessage(lang: Lang, v: { email: string; password: string; box?: string; name: string }): { subject: string; message: string } {
  const addr = `${v.name}, 8125 NW 67th Street, Box ${v.box ?? "…"}, Miami, FL 33166, USA`;
  if (lang === "en") return {
    subject: "Your JP's Logistics customer area is ready",
    message: `Your customer area is ready: follow your parcels online, from our Miami warehouse to Haiti.

Sign in: ${SITE} > "Customer area"
E-mail: ${v.email}
Temporary password: ${v.password}

For your security, change this password the first time you sign in (Customer area > "Change my password").

What you can do:
• Track each parcel: received in Miami, in transit, arrived in Haiti, ready for pickup.
• Announce an online order in advance (pre-alert) so we recognise your parcel as soon as it arrives.
• Get a notification on your phone when your parcel arrives: install the app (iPhone: Safari > Share > "Add to Home Screen"; Android: browser menu > "Install app"), then allow notifications.

Your Miami address: ${addr}

Need help? WhatsApp ${COMPANY.phone}.`,
  };
  if (lang === "es") return {
    subject: "Su espacio de cliente JP's Logistics está listo",
    message: `Su espacio de cliente está listo: siga sus paquetes en línea, desde nuestro almacén de Miami hasta Haití.

Para entrar: ${SITE} > "Espacio Cliente"
Correo: ${v.email}
Contraseña temporal: ${v.password}

Por su seguridad, cambie esta contraseña la primera vez que entre (Espacio Cliente > "Cambiar mi contraseña").

Lo que puede hacer:
• Seguir cada paquete: recibido en Miami, en tránsito, llegado a Haití, listo para retirar.
• Anunciar de antemano un pedido en línea (pre-alerta) para que reconozcamos su paquete en cuanto llegue.
• Recibir una notificación en su teléfono cuando llegue su paquete: instale la aplicación (iPhone: Safari > Compartir > "Añadir a pantalla de inicio"; Android: menú del navegador > "Instalar aplicación") y permita las notificaciones.

Su dirección en Miami: ${addr}

¿Necesita ayuda? WhatsApp ${COMPANY.phone}.`,
  };
  return {
    subject: "Votre espace client JP's Logistics est prêt",
    message: `Votre espace client est prêt : suivez vos colis en ligne, de notre entrepôt de Miami jusqu'en Haïti.

Pour vous connecter : ${SITE} > « Espace Client »
E-mail : ${v.email}
Mot de passe temporaire : ${v.password}

Pour votre sécurité, changez ce mot de passe dès votre première connexion (Espace Client > « Changer mon mot de passe »).

Ce que vous pouvez faire :
• Suivre chaque colis : reçu à Miami, en transit, arrivé en Haïti, prêt pour retrait.
• Annoncer à l'avance une commande en ligne (pré-alerte) pour que nous reconnaissions votre colis dès son arrivée.
• Recevoir une notification sur votre téléphone quand votre colis arrive : installez l'application (iPhone : Safari > Partager > « Sur l'écran d'accueil » ; Android : menu du navigateur > « Installer l'application »), puis autorisez les notifications.

Votre adresse à Miami : ${addr}

Besoin d'aide ? WhatsApp ${COMPANY.phone}.`,
  };
}

const sentToday = () => db.customers.filter((c) => c.invite && c.invite.status === "sent" && c.invite.at === nowStr()).length;

export type InviteStats = Awaited<ReturnType<typeof inviteStats>>;
export async function inviteStats() {
  const acc = await siteAccountStats();
  const withMail = db.customers.filter((c) => usableEmail(c));
  const hasAccount = db.customers.filter((c) => c.clientId);
  const invited = db.customers.filter((c) => c.invite?.status === "sent");
  const failed = db.customers.filter((c) => c.invite?.status === "failed");
  const signedIn = (c: Customer) => !!c.clientId && acc.login.has(c.clientId);
  const accepted = invited.filter(signedIn).length;
  const push = hasAccount.filter((c) => acc.push.has(c.clientId!)).length;
  const fresh = withMail.filter((c) => !c.clientId && !c.invite).length;
  const reminders = fresh === 0 && failed.length === 0 ? invited.filter((c) => c.clientId && !signedIn(c) && c.invite!.count < MAX_INVITES_PER_CUSTOMER && daysSince(c.invite!.at) >= REMIND_AFTER_DAYS).length : 0;
  const today = sentToday();
  return {
    total: db.customers.length, withMail: withMail.length, needMail: db.customers.length - withMail.length, hasAccount: hasAccount.length, invited: invited.length, failed: failed.length,
    accepted, signedInAll: hasAccount.filter(signedIn).length, push, fresh, reminders, today, left: Math.max(0, INVITES_PER_DAY - today), days: Math.ceil((fresh + failed.length) / INVITES_PER_DAY),
    loginTracking: acc.loginTracking, statsError: acc.error, acc,
  };
}

export type InviteResult = { sent: number; failed: string[]; linked: number; created: number; reminded: number; error?: string };
// Sends up to the day's remaining quota. Order: customers whose invitation failed, then customers never invited (by customer number),
// and only when everybody has been invited, a reminder (new temporary password) for those who never signed in.
export async function runInvites(): Promise<InviteResult> {
  const res: InviteResult = { sent: 0, failed: [], linked: 0, created: 0, reminded: 0 };
  if (!syncEnabled()) return { ...res, error: "The website is not connected (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)." };
  if (!mailEnabled()) return { ...res, error: mailSetupProblem() || "E-mail is not set up: SITE_STAFF_EMAIL and SITE_STAFF_PASSWORD are needed." };
  const quota = INVITES_PER_DAY - sentToday();
  if (quota <= 0) return { ...res, error: `Today's ${INVITES_PER_DAY} invitations are done. Come back tomorrow.` };

  // Customers who already have an account on the website (created by themselves) are linked, never invited.
  const site = await siteClients();
  if (site.error && !site.rows.length) return { ...res, error: `Could not read the website accounts: ${site.error}` };
  const byMail = new Map(site.rows.map((r) => [(r.email ?? "").toLowerCase(), r]));
  for (const c of db.customers) { const m = usableEmail(c); const hit = m ? byMail.get(m) : undefined; if (hit && !c.clientId) { c.clientId = hit.id; res.linked++; } }

  const acc = await siteAccountStats();
  const retry = db.customers.filter((c) => c.invite?.status === "failed" && usableEmail(c));
  const fresh = db.customers.filter((c) => usableEmail(c) && !c.clientId && !c.invite).sort((a, b) => a.no - b.no);
  const remind = retry.length || fresh.length ? [] : db.customers.filter((c) => c.invite?.status === "sent" && c.clientId && !acc.login.has(c.clientId) && c.invite.count < MAX_INVITES_PER_CUSTOMER && daysSince(c.invite.at) >= REMIND_AFTER_DAYS).sort((a, b) => a.no - b.no);
  const seen = new Set<string>(), batch: { c: Customer; kind: "new" | "retry" | "remind" }[] = [];
  for (const [list, kind] of [[retry, "retry"], [fresh, "new"], [remind, "remind"]] as const) for (const c of list) {
    const m = usableEmail(c)!;
    if (batch.length >= quota) break;
    if (seen.has(m)) continue; // two customers with the same address: one account, one e-mail
    seen.add(m); batch.push({ c, kind: kind === "retry" && !c.clientId ? "new" : kind }); // a failed invitation without an account is a new one
  }

  const one = async ({ c, kind }: (typeof batch)[number]) => {
    const email = usableEmail(c)!, password = tempPassword();
    let box: string | undefined;
    try {
      if (kind === "new") {
        const r = await siteSignup({ name: c.name, email, phone: c.phone, address: c.billing, password });
        if (r.code === "EMAIL_TAKEN") { const f = byMail.get(email); if (f) c.clientId = f.id; res.linked++; return; } // account exists meanwhile: nothing to send
        if (r.error || !r.id) { c.invite = { at: nowStr(), time: timeNow(), count: (c.invite?.count ?? 0), status: "failed", error: r.error }; return void res.failed.push(`${c.name} (${r.error})`); }
        c.clientId = r.id; box = r.box; res.created++;
        if (langOf(c) !== "fr") await siteSetLang(r.id, langOf(c));
      } else {
        const err = await siteResetPassword(email, password);
        if (err) return void res.failed.push(`${c.name} (${err})`);
        box = c.box;
      }
      if (box) c.box = box;
      const { subject, message } = inviteMessage(langOf(c), { email, password, box: c.box, name: c.name });
      const err = await mailOne(c.clientId!, subject, message);
      if (err) { c.invite = { at: nowStr(), time: timeNow(), count: c.invite?.count ?? 0, status: "failed", error: err }; return void res.failed.push(`${c.name} (${err})`); }
      c.invite = { at: nowStr(), time: timeNow(), count: (c.invite?.count ?? 0) + 1, status: "sent" };
      res.sent++; if (kind === "remind") res.reminded++;
    } catch (e) { res.failed.push(`${c.name} (${e instanceof Error ? e.message : e})`); }
  };
  for (let i = 0; i < batch.length; i += 5) await Promise.all(batch.slice(i, i + 5).map(one));
  return res;
}
