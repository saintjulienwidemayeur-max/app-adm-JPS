// What every server action goes through: the database copy is loaded, the person must be signed in, the action runs, it is written to the
// activity log (who, which action, with what, how it ended), and what changed is saved (also when the action ends with a redirect).
import { ensureLoaded, flush, refresh, lockActions } from "./persist";
import { requireUser } from "./users";
import { logAudit, summarize } from "./audit";
import { runAs } from "./actor";
import { allowed } from "./access";
import { redirect } from "next/navigation";

const decode = (s: string) => { try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s; } };
const words = (n: string) => n.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

// Which pages give the right to run an action. The middleware only checks the page a request is sent to, so a limited user could post
// another page's action to a page they may open: the action itself checks. Administrators may run everything; an action not listed here
// is for administrators only; "any" is open to every signed-in person.
const R = "/warehouse/receipts";
const PAGES: Record<string, string[]> = {
  any: ["changeOwnCode"],
  "/warehouse/receiving": ["startDelivery", "endDelivery", "receiveItem", "receiveBatch", "updateItem", "deleteItem"],
  "/warehouse/consolidate": ["singlePiece", "combinePieces", "scanForConsolidate"],
  [R]: ["createWR", "updateWR", "addPiece", "updatePiece", "deletePiece", "createInvoice", "addPayment", "voidPayment", "applyCredit", "addFee", "saveFees", "deleteFee", "switchShip", "notifyEmail", "markInvoiceSent", "cancelInvoice", "createOrder", "saveOrder", "addOrderItem", "saveOrderItems", "deleteOrderItem", "addOrderPayment", "voidOrderPayment"],
  "/warehouse/customers": ["createCustomer", "saveCustomer", "saveCustomerRates"],
  "/warehouse/reps": ["addRep", "saveRep", "deleteRep"],
  "/warehouse/estimate": ["estimateToReceipt", "dismissEstimateRequest", "emailEstimate"],
  "/warehouse/pickups": ["createPickup", "savePickup", "setPickupStatus"],
  "/warehouse/prealerts": ["savePrealert", "cancelPrealert"],
  "/warehouse/shipments": ["createShipment", "saveBooking", "notifyShipmentEmail"],
  "/warehouse/pallets": ["loadPiece", "unloadPiece", "shipCargo"],
  "/warehouse/arrivals": ["receiveHere", "arriveShipment", "markHereNotified", "markReady", "notifyEmail"],
  "/warehouse/payments": ["receivePayment"],
};
const mayRun = (u: { admin: boolean; perms: string[] }, name: string) =>
  u.admin || Object.entries(PAGES).some(([page, names]) => names.includes(name) && (page === "any" || allowed(u, page)));

export const act = <A extends unknown[]>(name: string, fn: (...a: A) => Promise<void>) => async (...a: A): Promise<void> => {
  await ensureLoaded();
  await refresh();
  const user = await requireUser();
  // The rights come first: someone who may not run the action is refused without ever waiting for (or holding) the lock.
  if (!mayRun(user, name)) { logAudit(user.name, words(name), "", "refused: no access to this action"); await flush(); redirect("/?denied=1"); }
  const unlock = await lockActions(); // one action at a time across both apps, from the fresh data to the save
  try {
    await refresh(false, true);
    let result = "ok";
    try { await runAs(user.name, () => fn(...a)); }
    catch (e) {
      const digest = (e as { digest?: string })?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) { const m = digest.match(/[?&]err=([^&;]*)/); result = m ? `refused: ${decode(m[1])}` : "ok"; }
      else result = `error: ${e instanceof Error ? e.message : String(e)}`;
      throw e;
    } finally { logAudit(user.name, words(name), summarize(a), result); await flush(); }
  } finally { unlock(); }
};
