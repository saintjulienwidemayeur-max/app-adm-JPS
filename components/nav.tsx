"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth";
import { ChevronRight, KeyRound, LogOut } from "lucide-react";
import { HOME, locate, isOn, visibleSections } from "@/lib/menu";

const Pill = ({ n, active }: { n?: number; active?: boolean }) => (n ? <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${active ? "bg-white text-brand" : "bg-white/20 text-white"}`}>{n}</span> : null);

export function Nav({ mode = "memory", user = null, badges = {}, version = "" }: { mode?: "memory" | "database" | "down"; user?: { name: string; admin: boolean; perms: string[] } | null; badges?: Record<string, number>; version?: string }) {
  const path = usePathname();
  if (path === "/login" || !user) return null;
  const SECTIONS = visibleSections(user);
  const here = locate(path);
  const total = (s: (typeof SECTIONS)[number]) => s.pages.reduce((a, p) => a + (badges[p.href] ?? 0), 0);
  return (
    <nav aria-label="Main" className="no-print sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-y-auto bg-brand text-sm text-white md:flex">
      <Link href="/" className="m-4 mb-3 block rounded-xl bg-white p-2.5 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="w-full" />
      </Link>
      <div className="flex flex-col gap-0.5 px-3">
        <Link href={HOME.href} aria-current={path === "/" ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-semibold transition ${path === "/" ? "bg-white text-brand shadow-sm" : "text-white/85 hover:bg-white/10 hover:text-white"}`}>
          <HOME.icon size={18} aria-hidden /> {HOME.label}
        </Link>
        <p className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">Sections</p>
        {SECTIONS.map((s) => {
          const open = here.section?.slug === s.slug;
          return (
            <div key={s.slug} className="mb-0.5">
              <Link href={`/menu/${s.slug}`} aria-expanded={open}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-semibold transition ${open ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"}`}>
                <s.icon size={18} aria-hidden /> <span className="min-w-0 flex-1 truncate">{s.title}</span>
                {!open && <Pill n={total(s)} />}
                <ChevronRight size={15} aria-hidden className={`shrink-0 text-white/60 transition-transform ${open ? "rotate-90" : ""}`} />
              </Link>
              {open && (
                <ul className="mb-2 ml-5 mt-1 flex flex-col gap-0.5 border-l border-white/20 pl-2">
                  {s.pages.map((p) => {
                    const active = isOn(path, p.href);
                    return (
                      <li key={p.href}>
                        <Link href={p.href} aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 transition ${active ? "bg-white font-semibold text-brand shadow-sm" : "text-white/85 hover:bg-white/10 hover:text-white"}`}>
                          <p.icon size={16} aria-hidden /> <span className="min-w-0 flex-1 truncate">{p.label}</span>
                          <Pill n={badges[p.href]} active={active} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-auto border-t border-white/15 p-3">
        <p className="px-3 pb-1 text-xs text-white/60">Signed in as <b className="text-white">{user.name}</b>{user.admin ? " (administrator)" : ""}</p>
        <Link href="/account" className="flex items-center gap-2 rounded-lg px-3 py-2 text-white/85 hover:bg-white/10 hover:text-white"><KeyRound size={16} aria-hidden /> My account</Link>
        <form action={logout}><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-white/85 hover:bg-white/10 hover:text-white"><LogOut size={16} aria-hidden /> Sign out</button></form>
        <p className={`px-3 pt-2 text-xs ${mode === "memory" ? "text-amber-300" : mode === "down" ? "text-red-300" : "text-white/55"}`}>
          {mode === "memory" ? "Memory only: data is lost when the server restarts." : mode === "down" ? "Database not reachable." : "Saved in the database."}
        </p>
        {version && <p className="px-3 pt-1 text-[11px] text-white/40">Version {version}</p>}
      </div>
    </nav>
  );
}
