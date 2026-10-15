import Link from "next/link";
import { ArrowRight, PackageOpen, Calculator, ReceiptText, Wallet, Zap } from "lucide-react";
import { SECTIONS } from "@/lib/menu";
import { menuBadges, owed } from "@/lib/badges";
import { money } from "@/lib/wh-store";
import { usToday } from "@/lib/clock";

export const metadata = { title: "Main menu · JP's Logistics" };
export const dynamic = "force-dynamic";

const card = "rounded-xl border border-[#dfe4f0] bg-white shadow-sm";
const QUICK = [
  { href: "/warehouse/receiving", label: "Scan a received parcel", icon: PackageOpen },
  { href: "/warehouse/estimate", label: "Price boxes (estimate)", icon: Calculator },
  { href: "/warehouse/receipts", label: "New warehouse receipt", icon: ReceiptText },
  { href: "/warehouse/billing", label: "Receive a payment", icon: Wallet },
];

export default function Home() {
  const b = menuBadges();
  const stats = [
    { href: "/warehouse/prealerts", n: String(b["/warehouse/prealerts"]), label: "Pre-alerts expected" },
    { href: "/warehouse/consolidate", n: String(b["/warehouse/consolidate"]), label: "Parcels to consolidate" },
    { href: "/warehouse/pickups", n: String(b["/warehouse/pickups"]), label: "Pickups scheduled" },
    { href: "/warehouse/invoices", n: money(owed()), label: `Owed on ${b["/warehouse/invoices"]} open invoice${b["/warehouse/invoices"] === 1 ? "" : "s"}` },
  ];
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1>Main menu</h1><p className="text-sm text-zinc-600">JP&apos;s Logistics &amp; More · Miami warehouse</p></div>
        <p className="text-sm text-zinc-500">{usToday()}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`${card} px-4 py-3 transition hover:border-brand hover:shadow-md`}>
            <div className="text-2xl font-extrabold text-brand">{s.n}</div>
            <div className="mt-0.5 text-xs text-zinc-600">{s.label}</div>
          </Link>))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <section key={s.slug} className={`${card} flex flex-col p-5`}>
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white"><s.icon size={22} aria-hidden /></span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-tight text-zinc-900"><Link href={`/menu/${s.slug}`} className="hover:text-brand">{s.title}</Link></h2>
                <p className="text-xs text-zinc-600">{s.blurb}</p>
              </div>
            </div>
            <ul className="mt-4 flex flex-1 flex-col gap-1">
              {s.pages.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-800 transition hover:bg-[#eaeefb] hover:text-brand">
                    <p.icon size={16} className="shrink-0 text-brand" aria-hidden /> <span className="flex-1">{p.label}</span>
                    {b[p.href] ? <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold leading-none text-white">{b[p.href]}</span> : null}
                  </Link>
                </li>))}
            </ul>
            <Link href={`/menu/${s.slug}`} className="mt-3 flex items-center gap-1 border-t border-[#eef1f8] pt-3 text-sm font-semibold text-brand hover:underline">Open the section <ArrowRight size={15} aria-hidden /></Link>
          </section>
        ))}
        <section className={`${card} flex flex-col p-5`}>
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#eaeefb] text-brand"><Zap size={22} aria-hidden /></span>
            <div><h2 className="text-lg font-bold leading-tight text-zinc-900">Quick start</h2><p className="text-xs text-zinc-600">The things done all day</p></div>
          </div>
          <ul className="mt-4 flex flex-col gap-1">
            {QUICK.map((q) => (
              <li key={q.href}><Link href={q.href} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-800 transition hover:bg-[#eaeefb] hover:text-brand"><q.icon size={16} className="shrink-0 text-brand" aria-hidden /> {q.label}</Link></li>))}
          </ul>
        </section>
      </div>
    </main>
  );
}
