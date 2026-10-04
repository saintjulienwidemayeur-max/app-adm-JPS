# JP's Logistics & More — frontend mode

No database needed yet. Data lives in memory (lib/store.ts) and resets when the dev server restarts.

    npm install
    npm run dev   # http://localhost:3000

Pages: Intake, Received items, Consolidate, Warehouse receipts (+ detail, report, labels), Load pallet (+ pallet labels), Loading sheet, Arrivals PV, Invoices, Customers, Reps.

## How receipts, customers and fees work
- **Customer number**: every customer gets a number (1001, 1002, ...). It is the first part of every label: `1001|JPF-11018|20032` = customer | receipt | piece.
- **Receipt number**: `JPF-` for air, `JPL-` for boat (ocean). Changing the ship type on a receipt renames it (not possible once a piece is loaded on a shipment).
- **Consolidate**: each piece opens its own new warehouse receipt, or (option) is added to the customer's latest open receipt.
- **Customers** hold the full name, phone, email, billing address, the consignee (name, phone, address, city, country) and the default route and rep. Everything is editable. A customer is also created automatically the first time a new name is typed on Consolidate or Warehouse receipts.
- **Reps**: add representatives, pick one per customer (new receipts start with it), change it on the receipt, filter receipts and invoices by rep.
- **Fees and credits**: one line each on the receipt (pick a known name or type a new one, it is remembered). A credit is subtracted from the total.
- **Insurance** (declared value + "Accepted"): ported from the old Access function `CalcCertIns`. JP's cost is 1.22% of the declared value, minimum $27. The customer pays 3.5% of the declared value, or a flat $50 when the 1.22% cost is $27 or less (declared value up to $2,213.12). No declared value, no insurance.

Test scans: JP1000001, JP1000002, JP1000003 (already registered, activate instantly).
Any other code opens the new-parcel form.

Supabase code is parked in _later/ (migration in supabase/migrations/001_init.sql). 

## Tracking website sync (optional)
Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (see `.env.example`). Then:
- Consolidate (customer assigned to a parcel, piece created) -> website status 0 (customer found by box number, e-mail or exact name)
- Ship this cargo -> status 1 · all pieces of a receipt scanned on Arrivals PV -> status 2 · "Ready for pickup" -> status 3
The website's existing webhook sends the push and the e-mail.
