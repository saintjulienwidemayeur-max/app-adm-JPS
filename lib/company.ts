// Company details printed on shipping documents. Read from the old Access forms; change them here if they move.
export const COMPANY = {
  name: "JP's Logistics and More LLC",
  address: "8125 NW 67th Street",
  city: "Miami, FL 33166",
  phone: "(786) 424-8025",
  email: "",
};
// Default consignee of a shipment: the Haiti office.
export const HAITI = {
  name: "JP's Haiti",
  address: "11 Rue Oge",
  city: "Petion-Ville, Haiti",
  phone: "(509) 3702-1722",
  email: "jpslogisticshaiti@gmail.com",
};
export const ORIGIN = "MIA FL USA";
export const DESTINATION = "PAP HAITI";
export const AIRLINE = "AMERIJET";

// Wording printed on the Bill of Lading. The fine print of the old Access form could not be read from the photo:
// replace this with the exact text of your original if it must match.
export const BOL_TERMS =
  "Received by the carrier the packages described above, in apparent good order and condition unless otherwise noted, to be carried to the place of delivery subject to the carrier's terms and conditions of carriage.";

// JP's own mailboxes. The old system used them as the e-mail of customers who had none, so many customers carry one of them: they are not
// a customer's address (never used to recognise a customer, for example to link a website account).
export const COMPANY_EMAILS = ["jpslogisticsmiami@gmail.com", "jpslogisticshaiti@gmail.com", COMPANY.email, HAITI.email].filter(Boolean).map((e) => e.toLowerCase());

// Addresses shared by many customers (several accounts of one company, or a placeholder): nothing is e-mailed there until the customers
// get a real address of their own. The administrator can add or remove addresses (Administration > Email customers).
export const BLOCKED_EMAILS = ["alainnonez@yahoo.com", "hantzjr.b@boulosdistribution.com", "romarmultiservices@gmail.com", "ramses60@aol.com"];

// How customers pay: printed in the e-mail that goes with a receipt.
export const PAY = {
  checkTo: "JPA LOGISTICS",
  haiti: { bank: "CAPITAL BANQUE", kind: "COMPTE COURANT", name: "JPA LOGISTICS", nameFr: "JPA LOGISTIQUE", gourdes: "1856676", usd: "1856677" },
  zelle: "1(786) 424-8025",
  us: { name: "JP's Logistics and More LLC", bank: "Bank of America", routing: "26009593", account: "229058052645" },
  address: "Miami, Florida 33166", phone: "+1(786) 424-8025",
};

// The other ways to pay, short (one line each), for the e-mails. Shown under the "Pay online" button; `**x**` is bold in the e-mail.
export function payOther(lang: "fr" | "en" | "es"): string {
  const p = PAY, hn = (p.haiti as { nameFr?: string; name: string }).nameFr ?? p.haiti.name;
  if (lang === "en") return `**Other ways to pay**\n• Zelle: ${p.zelle}\n• Haiti transfer: ${p.haiti.bank} · USD account ${p.haiti.usd} · gourdes account ${p.haiti.gourdes} · ${p.haiti.name}\n• US transfer: ${p.us.name} · ${p.us.bank} · routing ${p.us.routing} · account ${p.us.account}\n• Cash or a check to the order of "${p.checkTo}" at pickup or delivery.`;
  if (lang === "es") return `**Otras formas de pago**\n• Zelle: ${p.zelle}\n• Transferencia en Haití: ${p.haiti.bank} · cuenta USD ${p.haiti.usd} · cuenta en gourdes ${p.haiti.gourdes} · ${p.haiti.name}\n• Transferencia en EE. UU.: ${p.us.name} · ${p.us.bank} · ruta ${p.us.routing} · cuenta ${p.us.account}\n• Efectivo o cheque a nombre de "${p.checkTo}" en la recogida o la entrega.`;
  return `**Autres moyens de paiement**\n• Zelle : ${p.zelle}\n• Virement Haïti : ${p.haiti.bank} · compte USD ${p.haiti.usd} · compte gourdes ${p.haiti.gourdes} · ${hn}\n• Virement États-Unis : ${p.us.name} · ${p.us.bank} · routage ${p.us.routing} · compte ${p.us.account}\n• Espèces ou chèque à l'ordre de « ${p.checkTo} » à l'enlèvement ou à la livraison.`;
}
