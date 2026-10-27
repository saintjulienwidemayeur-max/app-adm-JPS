import { db } from "@/lib/wh-store";
import { requireAdmin } from "@/lib/users";
import { saveWhatsApp, testWhatsApp } from "@/lib/settings-actions";
import { WA_EVENTS, waConfigured } from "@/lib/whatsapp";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "WhatsApp · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const q = await searchParams, wa = db.settings.wa, ok = waConfigured();
  const reach = db.customers.filter((c) => !c.waOff && (c.whatsapp || c.phone)).length;
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1>WhatsApp</h1>
      <p className="text-sm text-zinc-600">The system sends short WhatsApp messages by itself, at the same moments as the e-mails (WaAPI service). The e-mails with the PDFs are not replaced: WhatsApp is an extra channel, and the only one for a customer with no usable e-mail.</p>
      {q.err && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p role="status" className="mt-3 text-sm font-medium text-green-700">{q.ok}</p>}
      {q.raw && <details className="mt-1 text-xs text-zinc-500"><summary className="cursor-pointer underline">What WaAPI answered</summary><pre className="mt-1 whitespace-pre-wrap rounded bg-zinc-100 p-2">{q.raw}</pre></details>}

      <section className="mt-4 rounded-lg border bg-white p-4 text-sm">
        <h2 className="font-bold">1. Connection</h2>
        <p className={`mt-1 font-medium ${ok ? "text-green-700" : "text-red-700"}`}>{ok ? "WAAPI_TOKEN is set on the server." : "WAAPI_TOKEN is NOT set on the server."}</p>
        <p className="mt-1 text-zinc-600">In Render (this app) &gt; Environment add <b>WAAPI_TOKEN</b> (the API token of WaAPI). If the account has several WhatsApp instances add also <b>WAAPI_INSTANCE_ID</b>; otherwise the first instance is used. The token is never stored in the code or in the database. Redeploy after you add it.</p>
      </section>

      <form action={saveWhatsApp} className="mt-4 grid gap-3 rounded-lg border bg-white p-4 text-sm">
        <h2 className="font-bold">2. Turn on, and choose the moments</h2>
        <label className="flex items-center gap-2"><input type="checkbox" name="on" defaultChecked={wa?.on === true} /> Send WhatsApp messages automatically</label>
        <div className="grid gap-1 pl-6">{WA_EVENTS.map((e) => <label key={e.key} className="flex items-center gap-2"><input type="checkbox" name={`ev_${e.key}`} defaultChecked={wa?.events?.[e.key] !== false} /> {e.label}</label>)}</div>
        <label className="grid max-w-xs gap-1 text-xs font-medium text-zinc-600">Country code for numbers typed without one (8 digits = Haiti)<Input name="cc" defaultValue={wa?.cc ?? "509"} maxLength={4} className="w-24" /></label>
        <p className="text-xs text-zinc-600">The number used is the customer&apos;s WhatsApp number if there is one, else the phone. {reach.toLocaleString("en-US")} customer{reach === 1 ? "" : "s"} have a number. Each customer can be switched off on the customer&apos;s page. Messages are sent one by one, a few seconds apart, and are listed in Email customers &gt; history.</p>
        <div><Button type="submit">Save</Button></div>
      </form>

      <form action={testWhatsApp} className="mt-4 grid gap-2 rounded-lg border bg-white p-4 text-sm">
        <h2 className="font-bold">3. Send a test</h2>
        <p className="text-xs text-zinc-600">Sends ONE real message now. Use your own number first.</p>
        <Input name="number" placeholder="+509 3700 1122" aria-label="WhatsApp number" required className="max-w-xs" />
        <Input name="message" placeholder="Test message (optional)" aria-label="Message" maxLength={500} />
        <div><Button type="submit" variant="outline" disabled={!ok}>Send the test</Button></div>
      </form>
    </main>
  );
}
