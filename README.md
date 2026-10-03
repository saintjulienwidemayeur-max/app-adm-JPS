# JP's Logistics & More — frontend mode

No database needed yet. Data lives in memory (lib/store.ts) and resets when the dev server restarts.

    npm install
    npm run dev   # http://localhost:3000

Pages: Intake, Received items, Warehouse receipts (+ detail, report, labels), Load pallet (+ pallet labels), Loading sheet.

Pages: Intake, Received items, Warehouse receipts (+ detail, report, labels), Load pallet (+ pallet labels), Loading sheet.

Test scans: JP1000001, JP1000002, JP1000003 (already registered, activate instantly).
Any other code opens the new-parcel form.

Supabase code is parked in _later/ (migration in supabase/migrations/001_init.sql). 

## Tracking website sync (optional)
Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (see `.env.example`). Then:
- Consolidate (customer assigned to a parcel, piece created) -> website status 0 (customer found by box number, e-mail or exact name)
- Ship this cargo -> status 1 · all pieces of a receipt scanned on Arrivals PV -> status 2 · "Ready for pickup" -> status 3
The website's existing webhook sends the push and the e-mail.
