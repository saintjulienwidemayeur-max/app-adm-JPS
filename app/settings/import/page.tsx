import { db } from "@/lib/wh-store";
import { requireAdmin } from "@/lib/users";
import { importCustomers, importCargo } from "@/lib/import-actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Import data · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const q = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1>Import data</h1>
      <h2 className="mt-4 text-lg font-bold">Customers</h2>
      <p className="text-sm text-zinc-600">Bring the customers of the old system into the app from a CSV file. Customer numbers are kept, with their phones, e-mails, address and rates (per lb Air, per cubic foot Ocean). The app has <b>{db.customers.length}</b> customer{db.customers.length === 1 ? "" : "s"} now.</p>
      {q.err && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{q.err}</p>}
      {q.done && (
        <div className={`mt-3 rounded-lg border p-3 text-sm ${q.done === "import" ? "border-green-300 bg-green-50" : "border-blue-300 bg-blue-50"}`}>
          <p className="font-semibold">{q.done === "import" ? "Imported." : "Check only: nothing was saved."} {q.total} customers in the file.</p>
          <ul className="mt-1 list-disc pl-5">
            <li><b>{q.added}</b> {q.done === "import" ? "added" : "would be added"}</li>
            <li><b>{q.updated}</b> already here, {q.done === "import" ? "completed or updated" : "would be completed or updated"}</li>
            <li><b>{q.unchanged}</b> already here, nothing to change</li>
            {Number(q.conflicts) > 0 && <li className="text-amber-800"><b>{q.conflicts}</b> skipped: the customer number is already used by somebody else</li>}
            {Number(q.problems) > 0 && <li className="text-amber-800"><b>{q.problems}</b> lines with a problem</li>}
          </ul>
          {q.detail && <p className="mt-1 text-xs text-zinc-700">{q.detail}</p>}
        </div>
      )}
      <form action={importCustomers} encType="multipart/form-data" className="mt-4 grid gap-3 rounded-lg border p-4">
        <label className="grid gap-1 text-sm font-medium text-zinc-700">CSV file (the one made for this import: clients_import.csv)
          <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
        </label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="overwrite" value="yes" className="mt-1" /> <span>For a customer already here, replace its details with the file&apos;s. Without this box, only the empty fields are filled.</span></label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="mode" value="check" variant="outline">1. Check the file (saves nothing)</Button>
          <Button type="submit" name="mode" value="import">2. Import</Button>
        </div>
        <p className="text-xs text-zinc-600">Always check first. A customer number already used by somebody else is skipped and listed. Importing twice does no harm: the second time nothing changes.</p>
      </form>

      <p className="mt-8 text-sm text-zinc-600">The old invoices and payments are imported in the billing system (Administration &gt; Import old invoices), after the customers.</p>

      <h2 className="mt-8 text-lg font-bold">Cargo history</h2>
      <p className="text-sm text-zinc-600">The old system&apos;s receipts, pieces, scanned parcels (tracking numbers) and shipments, kept for reference: search them in <b>Warehouse Receipts &gt; Old receipts</b> and <b>Prepare Shipping &gt; Old shipments</b>, and Received items warns when a tracking number was already received before. Import the customers first. The app has <b>{db.oldWrs.length.toLocaleString("en-US")}</b> old receipts and <b>{db.oldShips.length.toLocaleString("en-US")}</b> old shipments now. Importing again replaces them.</p>
      {q.cerr && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{q.cerr}</p>}
      {q.cdone && (
        <div className={`mt-3 rounded-lg border p-3 text-sm ${q.cdone === "import" ? "border-green-300 bg-green-50" : "border-blue-300 bg-blue-50"}`}>
          <p className="font-semibold">{q.cdone === "import" ? "Imported." : "Check only: nothing was saved."}</p>
          <ul className="mt-1 list-disc pl-5"><li><b>{Number(q.cr).toLocaleString("en-US")}</b> receipts with <b>{Number(q.cp).toLocaleString("en-US")}</b> pieces and <b>{Number(q.cs).toLocaleString("en-US")}</b> scanned parcels</li><li><b>{Number(q.ch).toLocaleString("en-US")}</b> shipments, <b>{Number(q.cl).toLocaleString("en-US")}</b> pieces on shipments</li></ul>
          {q.cx && <p className="mt-1 text-xs text-zinc-700">{q.cx}</p>}
        </div>
      )}
      <form action={importCargo} encType="multipart/form-data" className="mt-4 grid gap-3 rounded-lg border p-4">
        {([["receipts", "Receipts (old_receipts.csv)"], ["pieces", "Pieces (old_receipt_pieces.csv)"], ["scans", "Scanned parcels (old_scans.csv)"], ["ships", "Shipments (old_shipments.csv)"], ["shipPieces", "Pieces on shipments (old_shipment_pieces.csv)"]] as const).map(([k, label]) => (
          <label key={k} className="grid gap-1 text-sm font-medium text-zinc-700">{label}<input type="file" name={k} accept=".csv,text/csv" required className="text-sm" /></label>))}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="mode" value="check" variant="outline">1. Check the files (saves nothing)</Button>
          <Button type="submit" name="mode" value="import">2. Import</Button>
        </div>
        <p className="text-xs text-zinc-600">Choose the 5 files each time. Check first: it shows the totals so you can compare with the old system.</p>
      </form>
    </main>
  );
}
