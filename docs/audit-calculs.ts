import { db, hasCharges, keepOldFormulas, newCustomer, openWR, total, charges, credits, freightFee, freightQty, insuranceFee, balance, paidAmt, vol, cuft, chargeable, estimateFor, rateFor, r2, OCEAN_HANDLING } from "../lib/wh-store";
import { calcInsurance, cardFees } from "../lib/pricing";
import { estimate, parseEstimate } from "../lib/estimate";

let pass = 0, fail = 0; const bad: string[] = [];
const eq = (name: string, a: number, b: number, tol = 0.005) => { if (Math.abs(a - b) <= tol) pass++; else { fail++; bad.push(`${name}: got ${a}, expected ${b}`); } };
const R = (n: number) => Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-7) / 100; // half a cent rounds up

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

// ---- H. rounding traps: the app's Math.round(x * 100) / 100 against exact integer arithmetic (half-up), pieces with up to 2 decimals
{
  let seed2 = 777; const rr = () => (seed2 = (seed2 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const halfUp = (num: number, den: number) => Math.floor((2 * num + den) / (2 * den)); // integers below 2^53
  let off = 0, n = 0; const ex: string[] = [];
  for (let t = 0; t < 20000; t++) {
    const dec = rr() < 0.5 ? 10 : 100, ints = [0, 0, 0].map(() => Math.round((1 + rr() * 59) * dec)), [l, w, h] = ints.map((v) => v / dec);
    const P = ints[0] * ints[1] * ints[2]; // exact product x dec^3
    for (const [div, name, f] of [[132, "vol132", vol], [1788, "cuft1788", cuft]] as const) {
      const cents = halfUp(P * 100, div * dec ** 3), got = f({ no: 0, type: "", l, w, h, lbs: 1 });
      n++; if (Math.abs(got * 100 - cents) > 0.001) { off++; if (ex.length < 5) ex.push(`${name} ${l}x${w}x${h}: app ${got} exact ${cents / 100}`); }
    }
  }
  console.log(`H. exact-rounding check: ${n} computations, ${off} differ by a cent from exact half-up`, ex.join(" | "));
  // freight = r2(qty x rate) for typical rates and quantities
  let off2 = 0, n2 = 0; const ex2: string[] = [];
  for (const rate of [4.5, 4.15, 5, 16, 15.5, 17, 3.75]) for (let q100 = 1; q100 <= 30000; q100 += 7) {
    const exact = halfUp(q100 * Math.round(rate * 100), 100); // cents
    n2++; if (Math.abs(r2((q100 / 100) * rate) * 100 - exact) > 0.001) { off2++; if (ex2.length < 5) ex2.push(`${q100 / 100} x ${rate}: app ${r2((q100 / 100) * rate)} exact ${exact / 100}`); }
  }
  console.log(`H. freight rounding: ${n2} computations, ${off2} differ from exact half-up`, ex2.join(" | "));
}
// ---- I. legacy rule: pieces of invoiced receipts keep 139 / 1728; a receipt invoiced now is pinned to today's formulas
{
  const c = newCustomer("Legacy Customer");
  const a = openWR(c, "Air"); a.pieces.push({ no: db.n.piece++, type: "BOX", l: 30, w: 20, h: 20, lbs: 10, contents: "x" }); // old data: no `old` flag
  eq("legacy uninvoiced piece uses 132", vol(a.pieces[0]), R(12000 / 132));
  a.invoice = "INV-LEG"; keepOldFormulas();
  eq("legacy invoiced piece keeps 139", vol(a.pieces[0]), R(12000 / 139));
  eq("legacy invoice freight", freightFee(a), R(R(12000 / 139) * 4.5));
  const old = a.pieces[0].old; a.invoice = undefined; keepOldFormulas();
  eq("cancelling the invoice keeps the pieces on the old formula", vol(a.pieces[0]), R(12000 / 139)); void old;
  const o = openWR(c, "Ocean"); o.pieces.push({ no: db.n.piece++, type: "BOX", l: 30, w: 20, h: 20, lbs: 10, contents: "x", old: false });
  o.invoice = "INV-NEW"; keepOldFormulas();
  eq("a piece made today stays on 1788 when invoiced", cuft(o.pieces[0]), R(12000 / 1788));
}
// ---- J. a receipt with only freight (an Air receipt with no fee line) still has something to pay
{
  const c = newCustomer("Freight Only"); const w = openWR(c, "Air"); w.pieces.push({ no: db.n.piece++, type: "BOX", l: 20, w: 20, h: 20, lbs: 50, contents: "x", old: false });
  eq("freight-only receipt is billable", hasCharges(w) ? 1 : 0, 1); eq("empty receipt is not billable", hasCharges(openWR(c, "Air")) ? 1 : 0, 0);
}
// ---- K. special rates: Cap-Air / Cap-Ocean / SDQ / DR Ocean come first for their destination; the compare popup uses the destination's rates
{
  db.settings.rates["Cap Haitien"] = { air: 5.5, ocean: 17 };
  const plain = newCustomer("Plain"), special = newCustomer("Special", { rates: { air: 4.15, ocean: 15, capa: 5, capo: 18, sdq: 7, droc: 22 } });
  eq("plain Cap Air = destination rate", rateFor(plain, "Air", "Cap Haitien"), 5.5); eq("plain Cap Ocean = destination rate", rateFor(plain, "Ocean", "Cap Haitien"), 17);
  eq("special Cap Air", rateFor(special, "Air", "Cap Haitien"), 5); eq("special Cap Ocean", rateFor(special, "Ocean", "Cap Haitien"), 18);
  eq("special SDQ Air", rateFor(special, "Air", "Saint Domingue"), 7); eq("special DR Ocean", rateFor(special, "Ocean", "Saint Domingue"), 22);
  eq("special Port-au-Prince Air", rateFor(special, "Air", "Port-au-Prince"), 4.15);
  const w = openWR(plain, "Air", { dest: "Cap Haitien" }); w.pieces.push({ no: db.n.piece++, type: "BOX", l: 30, w: 20, h: 20, lbs: 20, contents: "x", old: false });
  eq("compare popup Ocean uses the destination rate", estimateFor(w, "Ocean").rate, 17);
}
// ---- L. insurance boundaries and the total of a receipt
{
  const c = newCustomer("Ins"); const w = openWR(c, "Air"); w.pieces.push({ no: db.n.piece++, type: "BOX", l: 20, w: 20, h: 20, lbs: 50, contents: "x", old: false });
  for (const [d, want] of [[2213, 50], [2213.4, 50], [2214, 77.49], [3000, 105]] as const) { w.declared = d; w.insurance = "Accepted"; eq(`insurance fee in total (${d})`, insuranceFee(w), want); }
  w.declared = 3000; eq("total = freight + insurance", total(w), R(freightFee(w) + 105));
  w.fees.push({ id: db.n.fee++, label: "Discount", amount: 5000, kind: "credit" }); eq("credits cannot make the total negative", total(w), 0);
}
// ---- Rounding: half a cent rounds up; invoiced (legacy) pieces keep the old rounding ----
{
  const wNew = openWR(db.customers[0] ?? newCustomer("Rounding test"), "Air", { rate: 4.5 });
  wNew.pieces.push({ no: 990001, type: "BOX", l: 1, w: 1, h: 1, lbs: 1.13, contents: "x", old: false, rd: 0 });
  eq("5.085 rounds up to 5.09 (new receipt)", freightFee(wNew), 5.09);
  const wOld = openWR(db.customers[0] ?? newCustomer("Rounding test"), "Air", { rate: 4.5 });
  wOld.pieces.push({ no: 990002, type: "BOX", l: 1, w: 1, h: 1, lbs: 1.13, contents: "x", old: false, rd: 1 });
  eq("5.085 stays 5.08 on an already invoiced receipt (rd=1)", freightFee(wOld), 5.08);
}

console.log(`final: passed ${pass}, failed ${fail}`); if (bad.length) console.log(bad.slice(0, 20).join("\n"));
