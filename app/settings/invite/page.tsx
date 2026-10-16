import Link from "next/link";
import { db } from "@/lib/wh-store";
import { requireAdmin } from "@/lib/users";
import { tryLoaded } from "@/lib/persist";
import { syncSiteClients } from "@/lib/site-clients";
import { inviteStats, inviteMessage, INVITES_PER_DAY, REMIND_AFTER_DAYS, SITE } from "@/lib/invites";
import { usableEmail } from "@/lib/mailrules";
import { mailEnabled } from "@/lib/jps-sync";
import { sendInvitations } from "@/lib/invite-actions";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const metadata = { title: "Invite customers · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;
const card = "rounded-xl border border-[#dfe4f0] bg-white shadow-sm";
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

function Step({ label, n, of, note }: { label: string; n: number; of: number; note?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm"><span className="font-semibold text-zinc-800">{label}</span><span className="text-zinc-600"><b className="text-brand">{n.toLocaleString("en-US")}</b> · {pct(n, of)}%</span></div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#eaeefb]"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(pct(n, of), n > 0 ? 2 : 0)}%` }} /></div>
      {note && <div className="mt-0.5 text-xs text-zinc-500">{note}</div>}
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const q = await searchParams;
  if (await tryLoaded()) await syncSiteClients();
  const s = await inviteStats();
  const next = db.customers.filter((c) => usableEmail(c) && !c.clientId && !c.invite).sort((a, b) => a.no - b.no).slice(0, 5);
  const recent = db.customers.filter((c) => c.invite).sort((a, b) => (b.invite!.at.split("/").reverse().join("-") + b.invite!.time).localeCompare(a.invite!.at.split("/").reverse().join("-") + a.invite!.time)).slice(0, 12);
  const sample = inviteMessage("fr", { email: "client@exemple.com", password: "Ab3dE5fGh7", box: "JPS-1234", name: "Marie Dupont" });
  const enabled = mailEnabled();
  const todo = s.fresh + s.failed + s.reminders;
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#16256b] to-brand p-6 text-white shadow-sm">
        <h1 className="!text-white">Invite customers to the website</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/85">Each customer with a real e-mail gets an account on <b>{SITE.replace("https://", "")}</b> and an e-mail with a temporary password, how to track parcels, and how to install the app to get a notification when a parcel arrives. {INVITES_PER_DAY} invitations a day at most. Someone already invited is only reminded once everybody else has been invited.</p>
      </div>
      {q.err && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-3 text-sm font-medium text-green-700">{q.ok}</p>}
      {q.fail && <p role="alert" className="mt-1 text-xs font-medium text-amber-700">Not sent: {q.fail}</p>}
      {!enabled && <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">E-mail is not set up yet (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_STAFF_EMAIL, SITE_STAFF_PASSWORD).</p>}
      {!s.loginTracking && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">To count who signed in, run <b>section 14</b> of the website&apos;s schema (<code>last_login_at</code>) in Supabase. Until then &quot;accepted&quot; shows 0.</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[["Customers", s.total, ""], ["With a real e-mail", s.withMail, `${s.needMail} wait for one`], ["Accepted (signed in)", s.accepted, `${s.signedInAll} signed in in all`], ["Notifications on (app)", s.push, "installed the app"]].map(([label, n, note]) => (
          <div key={String(label)} className={`${card} px-4 py-3`}><div className="text-2xl font-extrabold text-brand">{Number(n).toLocaleString("en-US")}</div><div className="text-sm font-semibold text-zinc-800">{label}</div><div className="text-xs text-zinc-500">{note || " "}</div></div>))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <section className={`${card} p-5`}>
          <h2 className="text-lg font-bold">Progress</h2>
          <div className="mt-3 grid gap-3">
            <Step label="Have a real e-mail" n={s.withMail} of={s.total} note={`${s.needMail} customers are not invited until they get one (missing, shared or company address)`} />
            <Step label="Have an account on the website" n={s.hasAccount} of={s.total} />
            <Step label="Invited by e-mail" n={s.invited} of={s.withMail} />
            <Step label="Accepted: signed in at least once" n={s.accepted} of={s.invited || 1} note="of the customers invited" />
            <Step label="Notifications on: installed the app" n={s.push} of={s.hasAccount || 1} note="of the customers with an account" />
          </div>
        </section>
        <section className={`${card} flex flex-col p-5`}>
          <h2 className="text-lg font-bold">Today</h2>
          <div className="mt-2 flex items-end gap-2"><span className="text-4xl font-extrabold text-brand">{s.today}</span><span className="pb-1 text-sm text-zinc-600">of {INVITES_PER_DAY} invitations sent</span></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#eaeefb]"><div className="h-full rounded-full bg-[#ff5500]" style={{ width: `${pct(s.today, INVITES_PER_DAY)}%` }} /></div>
          <p className="mt-3 text-sm text-zinc-700"><b>{s.fresh}</b> never invited{s.failed > 0 && <>, <b>{s.failed}</b> to retry</>}{s.reminders > 0 && <>, <b>{s.reminders}</b> reminders due</>}. {s.fresh + s.failed > 0 ? `About ${s.days} day${s.days === 1 ? "" : "s"} to invite everybody.` : s.reminders > 0 ? `Reminders go out after ${REMIND_AFTER_DAYS} days without signing in.` : "Nobody left to invite."}</p>
          {next.length > 0 && <p className="mt-2 text-xs text-zinc-500">Next: {next.map((c) => c.name).join(", ")}…</p>}
          <form action={sendInvitations} className="mt-auto pt-4">
            <ConfirmSubmit message={`Send up to ${s.left} invitations now? Each customer gets an account and an e-mail with a temporary password.`} disabled={!enabled || s.left === 0 || todo === 0} className="w-full">{s.left === 0 ? "Today's invitations are done" : todo === 0 ? "Nobody to invite" : `Send today's invitations (up to ${Math.min(s.left, todo)})`}</ConfirmSubmit>
          </form>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className={`${card} p-5`}>
          <h2 className="text-lg font-bold">What each customer receives</h2>
          <p className="text-xs text-zinc-600">In their language (French, English or Spanish), through the website, with its design. Example:</p>
          <p className="mt-2 text-sm font-semibold">{sample.subject}</p>
          <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[#f6f8fd] p-3 text-xs leading-relaxed text-zinc-800">{sample.message}</pre>
        </section>
        <section className={`${card} p-5`}>
          <h2 className="text-lg font-bold">Last invitations</h2>
          {recent.length === 0 ? <p className="mt-2 text-sm text-zinc-600">None yet.</p> : (
            <table className="mt-2 w-full text-left text-sm">
              <thead><tr><th className="py-1 font-semibold">Customer</th><th className="py-1 font-semibold">Date</th><th className="py-1 font-semibold">Result</th></tr></thead>
              <tbody>{recent.map((c) => { const signed = !!c.clientId && s.acc.login.has(c.clientId); return (
                <tr key={c.no} className="border-b border-zinc-100 align-top"><td className="py-1"><Link href={`/warehouse/customers/${c.no}`} className="text-brand underline">{c.name}</Link></td><td className="py-1 text-xs">{c.invite!.at}</td>
                  <td className={`py-1 text-xs ${c.invite!.status === "failed" ? "font-medium text-red-700" : signed ? "font-medium text-green-700" : "text-zinc-600"}`}>{c.invite!.status === "failed" ? `Failed: ${c.invite!.error ?? ""}` : signed ? "Signed in" : "Sent"}{c.invite!.count > 1 && ` · ${c.invite!.count} times`}</td></tr>); })}</tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-zinc-500">The temporary password is only in the e-mail: nobody here can read it. The customer is asked to change it at once.</p>
        </section>
      </div>
    </main>
  );
}
