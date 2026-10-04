import type { ReactNode } from "react";
import { db, COUNTRIES, type Customer } from "@/lib/wh-store";
import { Input } from "@/components/ui/input";

const F = ({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) => (
  <label className={`grid gap-1 text-xs font-medium text-zinc-600 ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>
);

// The customer form: who pays (Bill To) and who receives the cargo (consignee) in which country.
// Everything here can be edited later on the customer's page.
export function CustomerFields({ c }: { c?: Customer }) {
  return (
    <>
      <datalist id="countries">{COUNTRIES.map((x) => <option key={x} value={x} />)}</datalist>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold">Customer (Bill To)</legend>
        <F label="Full name" wide><Input name="name" defaultValue={c?.name} required /></F>
        <F label="Phone number"><Input name="phone" type="tel" defaultValue={c?.phone} /></F>
        <F label="Email"><Input name="email" type="email" defaultValue={c?.email} /></F>
        <F label="Billing address" wide><Input name="billing" defaultValue={c?.billing} placeholder="Street, city, state, zip" /></F>
      </fieldset>
      <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold">Consignee (who receives the cargo)</legend>
        <F label="Consignee name"><Input name="consignee" defaultValue={c?.consignee} placeholder="Leave empty if it is the customer" /></F>
        <F label="Consignee phone"><Input name="consigneePhone" type="tel" defaultValue={c?.consigneePhone} /></F>
        <F label="Address" wide><Input name="consigneeAddress" defaultValue={c?.consigneeAddress} /></F>
        <F label="City"><Input name="consigneeCity" defaultValue={c?.consigneeCity} /></F>
        <F label="Country"><Input name="consigneeCountry" list="countries" defaultValue={c?.consigneeCountry ?? "Haiti"} /></F>
      </fieldset>
      <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold">Handling</legend>
        <F label="Representative">
          <select name="rep" defaultValue={c?.rep ?? ""} className="h-9 w-full rounded-md border bg-white px-2 text-sm">
            <option value="">None</option>{db.reps.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.initials})</option>)}
          </select>
        </F>
        <F label="Route (default for new receipts)"><Input name="route" defaultValue={c?.route} maxLength={12} /></F>
      </fieldset>
    </>
  );
}
