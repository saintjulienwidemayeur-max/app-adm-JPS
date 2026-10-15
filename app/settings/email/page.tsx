import { db, cargoOf } from "@/lib/wh-store";
import { mailEnabled } from "@/lib/jps-sync";
import { syncSiteClients } from "@/lib/site-clients";
import { tryLoaded, flush } from "@/lib/persist";
import { requireUser } from "@/lib/users";
import { sendEmail } from "@/lib/mail-actions";
import { RecipientPicker } from "@/components/recipient-picker";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Email customers · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1 align-top";
const radio = "flex items-start gap-2 rounded-lg border border-zinc-200 bg-white p-3 has-[:checked]:border-brand has-[:checked]:bg-[#f3f6ff]";

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requireUser();
  const q = await searchParams;
  if (await tryLoaded()) { await syncSiteClients(); await flush(); }
  const enabled = mailEnabled();
  const people = db.customers.map((c) => ({ no: c.no, name: c.name, email: c.email, site: !!c.clientId || !!c.email })).sort((a, b) => a.name.localeCompare(b.name));
  const shipments = db.shipments.filter((s) => !s.shipped).map((s) => ({ name: s.name, ship: s.ship, n: new Set(cargoOf(s.name).rows.map((x) => x.w.cust)).size }));
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1>Email customers</h1>
      <p className="text-sm text-zinc-600">Write one e-mail and send it to all customers, to the customers of a shipment (for example one that cannot leave), or to the people you choose. It goes out through the website (Brevo), with the website&apos;s design, the customer&apos;s first name and language.</p>
      {!enabled && <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">E-mail is not set up yet. Add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_STAFF_EMAIL and SITE_STAFF_PASSWORD (an owner or agent account of the website&apos;s admin panel) to the environment.</p>}
      {q.err && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-3 text-sm font-medium text-green-700">{q.ok}</p>}
      {q.fail && <p role="alert" className="mt-1 text-xs font-medium text-amber-700">Not sent: {q.fail}</p>}

      <form action={sendEmail} className="mt-4 grid gap-4">
        <section className="rounded-lg border p-3">
          <h2 className="font-bold">1. Who receives it?</h2>
          <div className="mt-2 grid gap-2">
            <label className={radio}><input type="radio" name="mode" value="all" className="mt-1" /><span><b>All customers</b><span className="block text-xs text-zinc-600">Everyone who has an account on the website.</span></span></label>
            <label className={radio}><input type="radio" name="mode" value="shipment" className="mt-1" /><span className="flex-1"><b>The customers of a shipment</b><span className="block text-xs text-zinc-600">Everyone who has pieces loaded on it (for example a shipment that cannot leave).</span>
              <select name="shipment" className="mt-1.5 h-9 w-full max-w-sm rounded-md border border-zinc-300 bg-white px-2 text-sm" aria-label="Shipment" defaultValue="">
                <option value="">{shipments.length ? "Choose a shipment" : "No open shipment"}</option>
                {shipments.map((s) => <option key={s.name} value={s.name}>{s.name} · {s.ship} · {s.n} customer{s.n === 1 ? "" : "s"}</option>)}</select></span></label>
            <label className={radio}><input type="radio" name="mode" value="selected" className="mt-1" defaultChecked /><span className="flex-1"><b>One person, or the people I choose</b><span className="block text-xs text-zinc-600">Search and tick one or several. Only people with an account or an e-mail on the website can be chosen.</span></span></label>
          </div>
          <div className="mt-2"><RecipientPicker people={people} /></div>
        </section>

        <section className="rounded-lg border p-3">
          <h2 className="font-bold">2. The message</h2>
          <div className="mt-2 grid gap-2">
            <label className="grid gap-1 text-xs font-medium text-zinc-600">Subject<Input name="subject" maxLength={150} required /></label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">Message<textarea name="message" rows={8} maxLength={5000} required className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" /></label>
            <p className="text-xs text-zinc-600">The website adds &quot;Hello &lt;first name&gt;,&quot; before your text and the team signature after it. Write only the message.</p>
          </div>
        </section>
        <div><ConfirmSubmit message="Send this e-mail now? It cannot be taken back." disabled={!enabled}>Send the e-mail</ConfirmSubmit></div>
      </form>

      <h2 className="mt-8 font-bold">Sent from here</h2>
      {db.maillog.length === 0 ? <p className="mt-1 text-sm text-zinc-600">Nothing sent yet.</p> : (
        <table className="mt-2 w-full text-left text-sm">
          <thead><tr>{["When", "By", "To", "Subject", "Sent"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{db.maillog.slice(0, 20).map((m) => (
            <tr key={m.id} className="border-b border-zinc-100"><td className={td}>{m.date} {m.time}</td><td className={td}>{m.by}</td><td className={td}>{m.to}</td><td className={td}>{m.subject}</td>
              <td className={td}>{m.sent} of {m.total}{m.failed.length > 0 && <span className="block text-xs text-amber-700">Not sent: {m.failed.join("; ")}</span>}</td></tr>))}</tbody>
        </table>
      )}
    </main>
  );
}
