// Disclaimer printed at the bottom of every warehouse receipt (same wording as the old Access report, reviewed).
// Reviewed: the handling minimum is now per method (Air $35, Ocean $45, the Ocean fee is added automatically), pickup minimum $20,
// the insurance minimum ($50) is stated, and the customs / estimate clauses were added: the final invoice is issued only after customs
// and delivery, and an estimate or an early payment never fixes the final price.
export const DISCLAIMER = [
  "I am aware that shipping Undeclared Dangerous and Unauthorized goods is illegal and carries a hefty fine and in some cases is associated with possible jail time.",
  "I certify that this shipment does not contain any unauthorized or dangerous goods such as explosives, destructive devices, guns, hazardous items, etc., and that the contents of each piece are declared truthfully on this receipt.",
  "I am aware and I agree that this shipment is subject to appropriate aviation/sea security controls and relevant government regulations.",
  "I am aware that TSA Regulation: all cargo will be screened and/or inspected, and that I consent to the screening of this shipment.",
  "I acknowledge that the company is not liable for any loss and is only responsible for damages or missing boxes/items in a box only if listed in the attached packing list.",
  "I acknowledge that the company is not responsible for any delays caused by vessels, airplanes, customs and/or riots occurring in destination countries.",
  "The company is only liable for a maximum of $100.00 regardless of the value of the item being shipped, unless insurance was accepted and paid.",
  "I am aware that a minimum handling fee of $35 (Air) or $45 (Ocean) will be added to every shipment.",
  "I am aware that a minimum fee of $10 will be added for repacking and consolidation services.",
  "I am aware that a minimum fee of $20 will be charged for pickup, depending on location and quantity of boxes.",
  "I am aware that the minimum charge for insurance is $50, and that the declared value must be the real value of the contents.",
  "I am aware that customs duties, taxes, inspection fees or fines imposed by the authorities because of undeclared or incorrectly declared contents are my responsibility.",
  "I am aware that Air shipments are billed on the larger of the gross or the volumetric weight, and Ocean shipments on cubic feet.",
  "I am aware that after 30 days in our warehouse, a storage fee will be applied.",
  "I am aware that *TCA will be added to all COD shipments.",
  "I agree that this email endorsement and/or original signature, along with other shipping documents submitted will be retained in file until this shipment is delivered.",
  "With this email and/or original signature, I certify that I acknowledge and approve this disclaimer.",
];

// Printed with an estimate (the customer asked for one and may prepay).
export const ESTIMATE_NOTE =
  "This is an ESTIMATE, not an invoice. The final invoice is issued when all items have cleared customs, been delivered to our destination office, and all costs have been covered. Any amount received before that, based on this estimate, is contingent on the final invoice. The estimate is based on the contents declared by the customer; any additional fee imposed by the authorities because of undeclared contents or items that are not as declared is not included.";
