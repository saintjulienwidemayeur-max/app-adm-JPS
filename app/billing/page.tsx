import { redirect } from "next/navigation";
import { billingUrl } from "@/lib/billing-link";

export const metadata = { title: "Billing system · JP's Logistics" };
export const dynamic = "force-dynamic";

// The billing system (invoices, receivables, reports, payables, old invoices) is its own app: this opens it.
export default function Page() {
  const url = billingUrl("/");
  if (url) redirect(url);
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1>Billing system</h1>
      <p className="mt-2 text-sm text-zinc-700">The billing system is a separate app that uses the same database as this one. Its address is not set yet: add <b>BILLING_URL</b> (for example <code>https://jps-billing.onrender.com</code>) in Render &gt; Environment, then open this page again.</p>
    </main>
  );
}
