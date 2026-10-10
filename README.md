# JP's Logistics & More: warehouse app

    yarn install
    yarn dev   # http://localhost:3000

By default the data lives in memory and resets when the server restarts. Set `DATABASE_URL` (see `.env.example`) and everything is saved in Postgres instead.

## Saving the data (Postgres / Supabase)
1. Get a connection string. With Supabase: Project Settings > Database > Connection string > **Transaction pooler** (fill in your database password).
2. Put it in `DATABASE_URL` (Render: Environment). Restart the app.
3. That is all: on start the app creates its tables (`wh_customers`, `wh_receipts`, `wh_items`, `wh_loads`, `wh_shipments`, `wh_bookings`, `wh_pickups`, `wh_reps`, `wh_meta`), loads them, and saves every change. Each table has one row per record; the record is in the `data` column (jsonb), so you can browse it in the Supabase table editor.
- The tables have Row Level Security switched on with no policy, so the website's public (anon) key cannot read them. Only the server's own connection can.
- If the database is down, a red banner appears and changes are refused (or kept and retried if it goes down while the app runs). Nothing is ever saved over data the app could not load.
- Run a single copy of the app. Two copies writing at the same time are not supported.
- The Intake page (activate parcel, 4x6 label) is the older stand-alone flow: it still keeps its own data in memory.

## Pickups
The Pickups page schedules a driver to collect a parcel at the customer's address (address, contact, date and time, driver, notes). The pickup price becomes a "Pickup fee" line on the customer's open warehouse receipt (same ship type, not invoiced yet; a new receipt is opened if there is none), so it is already there when the invoice is made. Changing the price updates that line; cancelling the pickup removes it. Once the receipt is invoiced the price is locked (cancel the invoice first). After the pickup, mark it as picked up and add the pieces to the receipt.

## Password
Set `APP_PASSWORD` and every page asks for it (cookie for 30 days, Sign out in the menu). Without it the app is open to anyone who knows the address, so set it before real customers are in the database.

Pages: Intake, Received items, Consolidate, Warehouse receipts (+ detail, report, labels), Load pallet (+ pallet labels), Shipments (+ booking, Bill of Lading, Letter of Instruction, cargo list), Loading sheet, Arrivals PV, Invoices (+ printable invoice), Pickups, Customers, Reps.

## How receipts, customers and fees work
- **Customer number**: every customer gets a number (1001, 1002, ...). It is the first part of every label: `1001|JPF-11018|20032` = customer | receipt | piece.
- **Receipt number**: `JPF-` for air, `JPL-` for boat (ocean). Changing the ship type on a receipt renames it (not possible once a piece is loaded on a shipment).
- **Consolidate**: each piece opens its own new warehouse receipt, or (option) is added to the customer's latest open receipt.
- **Customers** hold the full name, phone, email, billing address, the consignee (name, phone, address, city, country) and the default route and rep. Everything is editable. A customer is also created automatically the first time a new name is typed on Consolidate or Warehouse receipts.
- **Reps**: add representatives, pick one per customer (new receipts start with it), change it on the receipt, filter receipts and invoices by rep.
- **Fees and credits**: one line each on the receipt (pick a known name or type a new one, it is remembered). A credit is subtracted from the total.
- **Shipments**: one per flight or boat. The booking (airline, AWB, dates, shipper, consignee, pallets with their dimensions, enclosed contents...) starts with the usual defaults from `lib/company.ts`. From it you print the **Bill of Lading**, the **Shipper's Letter of Instruction** and the **cargo list**. The Bill of Lading's fine print is a generic sentence (`BOL_TERMS` in `lib/company.ts`): replace it with the exact text of your original.
- **Invoices**: a receipt becomes an invoice with "Create invoice"; the invoice page lists the fee lines (freight lines say which WR, weight and pieces) and the credit-card totals.
- **Credit-card totals** (`lib/pricing.ts`, `cardFees`): Square invoice 2.9% + $0.30 and card present 2.6% + $0.10, added on top so JP's nets the full amount; manual entry 2.9% + $0.30 of the amount. Worked out from one old invoice ($20.00 gives $20.91 / $20.64 / $20.88): check them against another invoice and edit the rates if they differ.
- **Insurance** (declared value + "Accepted"): ported from the old Access function `CalcCertIns`. JP's cost is 1.22% of the declared value, minimum $27. The customer pays 3.5% of the declared value, or a flat $50 when the 1.22% cost is $27 or less (declared value up to $2,213.12). No declared value, no insurance.

Test scans: JP1000001, JP1000002, JP1000003 (already registered, activate instantly).
Any other code opens the new-parcel form.

Supabase code is parked in _later/ (migration in supabase/migrations/001_init.sql). 

## Tracking website sync (optional)
Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (see `.env.example`). Then:
- Consolidate (customer assigned to a parcel, piece created) -> website status 0 (customer found by box number, e-mail or exact name)
- Ship this cargo -> status 1 · all pieces of a receipt scanned on Arrivals PV -> status 2 · "Ready for pickup" -> status 3
The website's existing webhook sends the push and the e-mail.
