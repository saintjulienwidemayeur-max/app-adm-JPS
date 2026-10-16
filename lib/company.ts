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
