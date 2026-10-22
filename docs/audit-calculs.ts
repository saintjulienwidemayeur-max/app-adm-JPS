import { db, newCustomer, openWR, total, charges, credits, freightFee, freightQty, insuranceFee, balance, paidAmt, vol, cuft, chargeable, estimateFor, rateFor, r2, OCEAN_HANDLING } from "../lib/wh-store";
import { calcInsurance, cardFees } from "../lib/pricing";
import { estimate, parseEstimate } from "../lib/estimate";

let pass = 0, fail = 0; const bad: string[] = [];
const eq = (name: string, a: number, b: number, tol = 0.005) => { if (Math.abs(a - b) <= tol) pass++; else { fail++; bad.push(`${name}: got ${a}, expected ${b}`); } };
const R = (n: number) => Math.round(n * 100) / 100;

// A. insurance
for (const [d, want] of [[0, 0], [100, 50], [1000, 50], [2000, 50], [2213, 50], [2214, 77.49], [5000, 175], [10000, 350]] as const) eq(`insurance(${d})`, calcInsurance(d).customer, want);
// B. credit card sample from the old invoice ($20)
const c20 = cardFees(20); eq("card invoice fee", c20.invoice.fee, 0.91); eq("card present fee", c20.present.fee, 0.64); eq("card manual fee", c20.manual.fee, 0.88);
// C. random estimates vs an independent re-implementation, and vs a receipt built the way "Create the receipt" builds it
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = (a: number, b: number) => Math.round((a + rnd() * (b - a)) * 10) / 10;
const cust = newCustomer("Audit Customer");
for (let t = 0; t < 400; t++) {
  const n = 1 + Math.floor(rnd() * 4), q: Record<string, string> = { customer: "Audit" };
  const boxes = Array.from({ length: n }, (_, i) => { const b = { qty: 1 + Math.floor(rnd() * 3), l: pick(5, 60), w: pick(5, 40), h: pick(3, 40), lbs: pick(1, 90) }; q[`q_${i}`] = String(b.qty); q[`l_${i}`] = String(b.l); q[`w_${i}`] = String(b.w); q[`h_${i}`] = String(b.h); q[`lbs_${i}`] = String(b.lbs); q[`c_${i}`] = "x"; return b; });
  const declared = rnd() < 0.5 ? Math.round(pick(100, 5000)) : 0, insure = declared > 0 && rnd() < 0.7, pickup = rnd() < 0.3 ? 25 : 0, credit = rnd() < 0.2 ? 10 : 0;
  Object.assign(q, { declared: String(declared || ""), insure: insure ? "yes" : "", pickup: String(pickup || ""), credit: String(credit || ""), rateAir: "4.5", rateOcean: "16" });
  const inp = parseEstimate((k) => q[k]), est = estimate(inp);
  // independent
  let air = 0, cf = 0; for (const b of boxes) { const v1 = R(b.l * b.w * b.h / 132), c1 = R(b.l * b.w * b.h / 1788), ch = Math.max(b.lbs, v1); air += R(ch * b.qty); cf += R(c1 * b.qty); }
  const ins = insure && declared > 0 ? calcInsurance(declared).customer : 0;
  const airTot = Math.max(0, R(R(air * 4.5) + 35 + ins + pickup - credit)), oceanTot = Math.max(0, R(R(cf * 16) + 45 + ins + pickup - credit));
  eq(`est air #${t}`, est.air.total, airTot, 0.011); eq(`est ocean #${t}`, est.ocean.total, oceanTot, 0.011);
  // receipt built like estimateToReceipt
  for (const ship of ["Air", "Ocean"] as const) {
    const opt = ship === "Ocean" ? est.ocean : est.air;
    const w = openWR(cust, ship, { estimate: true, rate: opt.rate, declared, insurance: insure ? "Accepted" : "Declined" });
    for (const r of inp.rows) for (let k = 0; k < r.qty; k++) w.pieces.push({ no: db.n.piece++, type: "BOX", l: r.l, w: r.w, h: r.h, lbs: r.lbs, contents: "x" });
    const handling = ship === "Ocean" ? inp.handlingOcean : inp.handlingAir, auto = w.fees.find((x) => x.auto === "handling");
    if (auto) auto.amount = r2(handling); else if (handling > 0) w.fees.push({ id: db.n.fee++, label: "Handling fees", amount: r2(handling), kind: "charge" });
    if (pickup) w.fees.push({ id: db.n.fee++, label: "Pickup fee", amount: pickup, kind: "charge" });
    if (credit) w.fees.push({ id: db.n.fee++, label: "Discount", amount: credit, kind: "credit" });
    eq(`receipt ${ship} #${t} vs estimate`, total(w), opt.total, 0.011);
    // compare-ship popup on a plain receipt (no handling for Air in estimateFor)
  }
}
// D. a plain Air receipt: no automatic $35 handling (the disclaimer and the estimate say $35)
const air = openWR(cust, "Air"); air.pieces.push({ no: db.n.piece++, type: "BOX", l: 24, w: 18, h: 16, lbs: 40, contents: "x" });
const expectedAirFreight = R(Math.max(40, R(24 * 18 * 16 / 132)) * 4.5);
eq("plain Air receipt freight", freightFee(air), expectedAirFreight);
const airHasHandling = air.fees.some((f) => /handling/i.test(f.label));
console.log("plain Air receipt has an automatic handling line:", airHasHandling, "(estimate page adds $35 for Air by default)");
// E. credit/payment logic
const w2 = openWR(cust, "Ocean"); w2.pieces.push({ no: db.n.piece++, type: "BOX", l: 30, w: 20, h: 20, lbs: 20, contents: "x" });
eq("ocean handling auto line", w2.fees.find((f) => f.auto === "handling")?.amount ?? 0, OCEAN_HANDLING);
eq("ocean cuft", cuft(w2.pieces[0]), R(30 * 20 * 20 / 1788)); eq("ocean freight", freightFee(w2), R(R(30 * 20 * 20 / 1788) * 16));
w2.payments.push({ date: "1/1/2026", amount: 10, method: "Cash", ref: "" }); eq("balance after payment", balance(w2), R(total(w2) - 10));
// F. other-method estimate popup vs real switch
const w3 = openWR(cust, "Air"); w3.pieces.push({ no: db.n.piece++, type: "BOX", l: 30, w: 20, h: 20, lbs: 20, contents: "x" });
const asOcean = estimateFor(w3, "Ocean"); eq("compare popup Ocean total", asOcean.total, R(R(R(30*20*20/1788) * 16) + 45));
console.log(`checks passed: ${pass}, failed: ${fail}`); if (bad.length) console.log(bad.slice(0, 15).join("\n"));
// G. compare popup with a handling line typed by hand on an Air receipt ($35): Ocean must show $45, not $35+$45
const w4 = openWR(cust, "Air"); w4.pieces.push({ no: db.n.piece++, type: "BOX", l: 30, w: 20, h: 20, lbs: 20, contents: "x" });
w4.fees.push({ id: db.n.fee++, label: "Handling fees", amount: 35, kind: "charge" });
eq("compare popup ignores the hand-typed Air handling", estimateFor(w4, "Ocean").total, R(R(R(30*20*20/1788) * 16) + 45));
console.log(`final: passed ${pass}, failed ${fail}`);
