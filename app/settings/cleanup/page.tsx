import { db, money, paidAmt } from "@/lib/wh-store";
import { requireAdmin } from "@/lib/users";
import { tryLoaded, countBillingTables, countDocs } from "@/lib/persist";
import { cleanupTestData } from "@/lib/wh-actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Delete test data · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;

// When the testing is over: deletes what was added while testing (receipts, parcels, shipments, payments...). The customers stay.
export default async function Page({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const q = await searchParams, loaded = await tryLoaded();
  const bt = loaded ? await countBillingTables() : {}, docs = loaded ? await countDocs() : 0;
  const invoiced = db.wrs.filter((w) => w.invoice).length, paid = db.wrs.reduce((a, w) => a + paidAmt(w), 0);
  const credit = db.customers.filter((c) => (c.creditLog ?? []).length).length;
  const rows: [string, string, string, number, string][] = [
    ["receipts", "Warehouse receipts", `with their pieces, fees, invoices (${invoiced}) and payments (${money(paid)}); also takes everything off the cargos`, db.wrs.length, "wr"],
    ["parcels", "Received parcels", "the scanned tracking numbers (Received items)", db.items.length, "items"],
    ["cargo", "Shipments and cargo", "shipments, pallets, what is loaded, bookings", db.shipments.length, "shipments"],
    ["pickups", "Pickups", "", db.pickups.length, "pickups"],
    ["prealerts", "Pre-alerts", "the ones customers announced", db.prealerts.length, "pre-alerts"],
    ["orders", "Purchase orders", "(Billing > Orders)", db.orders.length, "orders"],
    ["billing", "Billing extras", "bills to pay, expenses, account balances", Object.values(bt).reduce((a, b) => a + b, 0), "rows"],
    ["credit", "Customers' credit", "the credit left by test payments", credit, "customers"],
    ["docs", "Stored PDFs", "the receipts and invoices that were e-mailed", docs, "files"],
    ["mail", "E-mail history", "", db.maillog.length, "lines"],
    ["activity", "Activity log", "", db.audit.length, "lines"],
    ["site", "On the website", "the receipts and payments shown in the customers' spaces, and the tracking entries made from the deleted parcels", 0, ""],
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1>Delete test data</h1>
      <p className="text-sm text-zinc-600">When the testing is over, remove here what was added while testing, so the real work starts clean.</p>
      <p className="mt-2 rounded-md bg-green-50 p-3 text-sm text-green-900"><b>Kept, always:</b> the customers (and their website accounts), the reps, the users, the rates and settings, and everything imported from the old system (old receipts, old shipments, old invoices). The numbering goes on where it was (the next receipt does not go back to the first number).</p>
      {q.err && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p role="status" className="mt-3 text-sm font-medium text-green-700">{q.ok}</p>}
      {q.warn && <p role="alert" className="mt-1 text-sm font-medium text-amber-700">{q.warn}</p>}
      <form action={cleanupTestData} className="mt-4 grid gap-3 rounded-lg border p-4">
        <ul className="grid gap-2">
          {rows.map(([key, label, note, n, unit]) => (
            <li key={key}><label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" name={key} className="mt-1" />
              <span><b>{label}</b>{unit && <span className="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">{n} {unit}</span>}{note && <span className="block text-xs text-zinc-600">{note}</span>}</span></label></li>))}
        </ul>
        <label className="grid gap-1 text-sm font-medium">Type DELETE to confirm
          <Input name="confirm" autoComplete="off" placeholder="DELETE" className="w-40" /></label>
        <div><ConfirmSubmit message="Delete everything ticked? This cannot be taken back. The customers are kept.">Delete what is ticked</ConfirmSubmit></div>
      </form>
    </main>
  );
}
