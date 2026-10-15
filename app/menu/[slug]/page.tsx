import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { SECTIONS, visibleSections } from "@/lib/menu";
import { requireUser } from "@/lib/users";
import { menuBadges } from "@/lib/badges";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params, s = SECTIONS.find((x) => x.slug === slug);
  return { title: `${s?.title ?? "Menu"} · JP's Logistics` };
}

// One section of the menu: each tool as a card, with what is waiting in it.
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params, me = await requireUser(), s = visibleSections(me).find((x) => x.slug === slug);
  if (!s) notFound();
  const b = menuBadges();
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-sm"><s.icon size={28} aria-hidden /></span>
        <div><h1>{s.title}</h1><p className="text-sm text-zinc-600">{s.blurb}</p></div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {s.pages.map((p) => (
          <Link key={p.href} href={p.href} className="group flex items-start gap-4 rounded-xl border border-[#dfe4f0] bg-white p-5 shadow-sm transition hover:border-brand hover:shadow-md">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#eaeefb] text-brand transition group-hover:bg-brand group-hover:text-white"><p.icon size={22} aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-base font-bold text-zinc-900">{p.label}{b[p.href] ? <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold leading-none text-white">{b[p.href]}</span> : null}</span>
              <span className="mt-0.5 block text-sm text-zinc-600">{p.desc}</span>
            </span>
            <ArrowRight size={18} aria-hidden className="mt-1 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-brand" />
          </Link>
        ))}
      </div>
    </main>
  );
}
