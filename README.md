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

## Pre-alerts, schedule and receipts
- **Pre-alerts** (`/warehouse/prealerts`): the form is on the customer website (customer area > "Annoncer un colis"), not here: carrier, final tracking number, store, contents, value, Air or Ocean, "wait for my other orders", and a confirmation. It needs section 13 of the website's `jps-logistics-supabase-schema.sql` (table `prealerts`). The warehouse app reads it with the same `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` as the tracking sync: it is the same database: what customers announce appears on the Pre-alerts page by itself, and scanning the tracking number on Received items finds the pre-alert and matches the parcel to the customer. A parcel nobody announced waits in the **review queue**. `lib/compliance.ts` lists what is checked.
- **Schedule** (`lib/schedule.ts`): Air leaves every Friday, Ocean every Wednesday; instructions are needed 2 business days before. No answer = Air. "Wait for other orders" holds a parcel up to 3 scheduled shipments.
- **Consolidate** adds each piece at once to the customer's open receipt of that method (Air and Ocean are separate receipts). Every piece has its own required **contents**.
- **Receipt**: freight is an automatic line (Air = larger of gross and volumetric lb x rate, Ocean = cubic feet x rate; standard rates `AIR_RATE`, `OCEAN_RATE` in `lib/wh-store.ts`), Ocean adds the $45 handling fee, **Compare Air/Ocean** shows the other method's estimate and can switch the receipt, a **notification log** (Email / WhatsApp) shows whether the customer was told and whether an update is still unsent. The printed receipt shows prices only when the customer asked for an estimate.
- **Letter of Instruction** follows form SLI (revision 09/09/2024); the extra fields are on the shipment's booking page.

## Estimate
`/warehouse/estimate` prices a customer's boxes before they ship, Air and Ocean side by side (`lib/estimate.ts`). Enter the boxes (number, L x W x H in inches, weight in lb, contents) and the rates and extras; the result updates by itself and the values live in the URL (shareable, survives a refresh). Air = larger of gross and volumetric weight (L x W x H / 139) x rate per lb; Ocean = cubic feet x rate, with the Ocean handling fee ($45; Air $35 is the disclaimer's minimum, editable); insurance (3.5%, minimum $50), pickup, repacking, another fee and a discount; credit-card totals for staff. **Print the estimate** gives the customer's copy with the "estimate, contingent to final invoicing" note. **Create the receipt** turns it into a warehouse receipt marked as an estimate (pieces, handling, insurance and fees included, the same total).

## Pickups
The Pickups page schedules a driver to collect a parcel at the customer's address (address, contact, date and time, driver, notes). The pickup price becomes a "Pickup fee" line on the customer's open warehouse receipt (same ship type, not invoiced yet; a new receipt is opened if there is none), so it is already there when the invoice is made. Changing the price updates that line; cancelling the pickup removes it. Once the receipt is invoiced the price is locked (cancel the invoice first). After the pickup, mark it as picked up and add the pieces to the receipt.

## Sign-in, users and access
Every page needs a sign-in with a **name and a code**. The first administrator is created automatically: name `jpsadmin1`, code `4888` (a banner reminds you to change it: **My account** at the bottom of the menu, or Administration > Users & access). An administrator opens everything and manages the users; he can change any name or code whenever he wants.
- **Administration > Users & access** (administrators only): create a person (for example Patrick, code 4888), then tick **which pages** he may open (by section, or page by page), or make him an administrator. A limited user only sees those pages in the menu and the other addresses send him back to the main menu. Deactivate or remove someone at any time. There is always at least one active administrator. A change of access applies at once to what the person saves, and to the pages he opens next (his sign-in lasts 12 hours).
- Codes are stored hashed (scrypt), never in clear. A code can be short (4 characters minimum), so 5 wrong codes for a name lock that name for 10 minutes. Use a longer code for administrators.
- The sign-in cookie is signed with `AUTH_SECRET`, or else with a secret derived from `DATABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. Set one of them in production.
- `APP_PASSWORD` is no longer used.

## Import the customers of the old system
**Administration > Import customers** (administrators only) reads a CSV file (one line per customer, header line: `customer_no, name, company, contact, street, city, state, zip, country, phone, whatsapp, alt_phone, email, email_more, rate_ocean, rate_air, rate_capa, rate_capo, sdq, droc, id_on_file, rep_code, created`; UTF-8 or Excel's Windows-1252). **Check the file** saves nothing and shows what would happen; **Import** saves. Customer numbers are kept; a number already used by someone else is skipped and listed; importing twice changes nothing; a customer already here only gets its empty fields filled (or the file's values, with the box ticked). Several customers may share one e-mail. Each customer keeps its own **rates** (Customers > open a customer > Rates): they are used on that customer's new receipts and on the Estimate page. The customer's other e-mails, WhatsApp, other phone, ID on file and old rep code are kept too. The CSV itself must never be committed to the repository (personal data).

## Customers from the website, and e-mail
- Same Supabase database as the customer website: **a customer who creates an account on the website appears in Customers by themselves** (number, "Website" tag, box number, phone, address, language), matched by website id then by e-mail. Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (the project's secret key `sb_secret_...` works).
- **Administration > Email customers**: write one e-mail and send it to **all customers**, to **the customers of a shipment** (the ones who have pieces loaded on it, for example a shipment that cannot leave), or to **one or several chosen people**. It goes through the website: the app calls the website's `admin-mail` function (Brevo) with a staff account of the website's admin panel (`SITE_STAFF_EMAIL`, `SITE_STAFF_PASSWORD`, an owner or agent), so the e-mail has the website's design, the customer's first name and language. What was sent (when, by whom, to whom, how many) is listed on the page. Someone with no website account cannot be e-mailed from here.

Pages: Estimate, Pre-alerts, Intake, Received items, Consolidate, Warehouse receipts (+ detail, report, labels), Load pallet (+ pallet labels), Shipments (+ booking, Bill of Lading, Letter of Instruction, cargo list), Loading sheet, Arrivals PV, Invoices (+ printable invoice), Pickups, Customers, Reps.

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
