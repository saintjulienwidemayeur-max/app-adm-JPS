// What is printed must be what is owed: every fee, credit and the total appear on the receipt PDF and on the invoice PDF, and the shared
// lines (docLines) add up to the total. Run with: npx tsx docs/audit-documents.mts   (needs pdftotext: apt install poppler-utils)
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { db, openWR, newCustomer, docLines, total, money, r2 } from "../lib/wh-store";
import { receiptPdf, invoicePdf } from "../lib/pdf";

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => { if (got === want) pass++; else { fail++; console.log(`FAIL ${name}: got ${got}, expected ${want}`); } };
const text = (bytes: Uint8Array) => { const f = `/tmp/audit-doc-${process.pid}.pdf`; fs.writeFileSync(f, bytes); try { return execFileSync("pdftotext", ["-layout", f, "-"]).toString(); } catch { return ""; } finally { fs.rmSync(f, { force: true }); } };

let n = 0;
for (const [label, ship, withFees] of [["Air with fees and a credit", "Air", true], ["Ocean with fees", "Ocean", true], ["Air, freight only", "Air", false]] as const) {
  const w = openWR(db.customers[0] ?? newCustomer("Doc test"), ship, { rate: ship === "Air" ? 4.5 : 16, declared: 1500, insurance: "Accepted" });
  w.pieces.push({ no: 995001 + n++, type: "BOX", l: 24, w: 18, h: 16, lbs: 40, contents: "Clothes", old: false, rd: 0 });
  if (withFees) w.fees.push({ id: 9001, label: "Pickup fee", amount: 25, kind: "charge" }, { id: 9002, label: "Repacking fee", amount: 10, kind: "charge" }, { id: 9003, label: "Customer discount", amount: 7, kind: "credit" });
  eq(`${label}: the lines add up to the total`, r2(docLines(w).reduce((a, l) => a + l.amount, 0)), total(w));
  for (const name of ["receipt PDF", "invoice PDF"]) {
    if (name === "invoice PDF") w.invoice = "INV-TEST";
    const t = text(name === "receipt PDF" ? await receiptPdf(w) : await invoicePdf(w)).replace(/\s+/g, " ");
    if (!t) { console.log(`skipped: pdftotext is not installed (${name})`); continue; }
    const missing = [...w.fees.map((f) => f.label), money(total(w))].filter((x) => !t.includes(x));
    eq(`${label}: ${name} shows every fee, credit and the total (missing: ${missing.join(", ") || "none"})`, missing.length, 0);
  }
  w.invoice = undefined;
}
console.log(`documents: passed ${pass}, failed ${fail}`);
process.exit(fail ? 1 : 0);
