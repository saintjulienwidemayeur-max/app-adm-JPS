"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth";
import { ChevronRight, KeyRound, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { InstallButton } from "@/components/pwa";
import { HOME, locate, isOn, visibleSections } from "@/lib/menu";

const Pill = ({ n, active }: { n?: number; active?: boolean }) => (n ? <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${active ? "bg-white text-brand" : "bg-white/20 text-white"}`}>{n}</span> : null);
const KEY = "jps_nav_open"; // "1" while the person has it open (this tab only: a new launch starts closed)

type Props = { mode?: "memory" | "database" | "down"; user?: { name: string; admin: boolean; perms: string[] } | null; badges?: Record<string, number>; version?: string };

// The menu: open (names and pages), or a thin rail of icons. The small icon at the top opens and closes it (and the choice is remembered).
// On a phone there is no sidebar: a top bar with the same icon opens the menu over the page.
export function Nav({ mode = "memory", user = null, badges = {}, version = "" }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false); // closed when the app starts, until it is opened
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { try { if (sessionStorage.getItem(KEY) === "1") setOpen(true); } catch { /* private window */ } }, []);
  useEffect(() => { setDrawer(false); }, [path]);
  if (path === "/login" || !user) return null;
  const toggle = () => setOpen((v) => { try { sessionStorage.setItem(KEY, v ? "0" : "1"); } catch { /* ignore */ } return !v; });

  const SECTIONS = visibleSections(user);
  const here = locate(path);
  const total = (s: (typeof SECTIONS)[number]) => s.pages.reduce((a, p) => a + (badges[p.href] ?? 0), 0);
  const note = mode === "memory" ? "Memory only: data is lost when the server restarts." : mode === "down" ? "Database not reachable." : "Saved in the database.";
  const noteColor = mode === "memory" ? "text-amber-300" : mode === "down" ? "text-red-300" : "text-white/55";

  const full: ReactNode = (
    <>
      <div className="flex flex-col gap-0.5 px-3">
        <Link href={HOME.href} aria-current={path === "/" ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 font-semibold transition ${path === "/" ? "bg-white text-brand shadow-sm" : "text-white/85 hover:bg-white/10 hover:text-white"}`}>
          <HOME.icon size={18} aria-hidden /> {HOME.label}
        </Link>
        <p className="mt-2 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">Sections</p>
        {SECTIONS.map((s) => {
          const on = here.section?.slug === s.slug;
          return (
            <div key={s.slug} className="mb-0.5">
              <Link href={`/menu/${s.slug}`} aria-expanded={on}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 font-semibold transition ${on ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"}`}>
                <s.icon size={18} aria-hidden /> <span className="min-w-0 flex-1 truncate">{s.title}</span>
                {!on && <Pill n={total(s)} />}
                <ChevronRight size={15} aria-hidden className={`shrink-0 text-white/60 transition-transform ${on ? "rotate-90" : ""}`} />
              </Link>
              {on && (
                <ul className="mb-2 ml-5 mt-1 flex flex-col gap-0.5 border-l border-white/20 pl-2">
                  {s.pages.map((p) => {
                    const active = isOn(path, p.href);
                    return (
                      <li key={p.href}>
                        <Link href={p.href} aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition ${active ? "bg-white font-semibold text-brand shadow-sm" : "text-white/85 hover:bg-white/10 hover:text-white"}`}>
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
      <div className="mt-auto border-t border-white/15 p-2">
        <p className="px-3 pb-1 text-xs text-white/60">Signed in as <b className="text-white">{user.name}</b>{user.admin ? " (administrator)" : ""}</p>
        <InstallButton />
        <Link href="/account" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-white/85 hover:bg-white/10 hover:text-white"><KeyRound size={16} aria-hidden /> My account</Link>
        <form action={logout}><button className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-white/85 hover:bg-white/10 hover:text-white"><LogOut size={16} aria-hidden /> Sign out</button></form>
        <p className={`px-3 pt-1 text-xs ${noteColor}`}>{note}</p>
        {version && <p className="px-3 pt-1 text-[11px] text-white/40">Version {version}</p>}
      </div>
    </>
  );

  const rail: ReactNode = (
    <>
      <div className="flex flex-col items-center gap-1 px-1.5">
        <Link href={HOME.href} title={HOME.label} aria-label={HOME.label} className={`flex size-10 items-center justify-center rounded-lg ${path === "/" ? "bg-white text-brand" : "text-white/85 hover:bg-white/10"}`}><HOME.icon size={19} aria-hidden /></Link>
        {SECTIONS.map((s) => (
          <Link key={s.slug} href={`/menu/${s.slug}`} title={s.title} aria-label={s.title} className={`relative flex size-10 items-center justify-center rounded-lg ${here.section?.slug === s.slug ? "bg-white/20 text-white" : "text-white/85 hover:bg-white/10"}`}>
            <s.icon size={19} aria-hidden />
            {total(s) > 0 && <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-amber-300" />}
          </Link>))}
      </div>
      <div className="mt-auto flex flex-col items-center gap-1 border-t border-white/15 px-1.5 py-2">
        <Link href="/account" title="My account" aria-label="My account" className="flex size-10 items-center justify-center rounded-lg text-white/85 hover:bg-white/10"><KeyRound size={18} aria-hidden /></Link>
        <form action={logout}><button title="Sign out" aria-label="Sign out" className="flex size-10 items-center justify-center rounded-lg text-white/85 hover:bg-white/10"><LogOut size={18} aria-hidden /></button></form>
      </div>
    </>
  );

  const iconBtn = "flex size-9 shrink-0 items-center justify-center rounded-lg text-white/90 hover:bg-white/10 hover:text-white";
  return (
    <>
      {/* Phone: top bar + the menu over the page */}
      <div className="no-print flex h-12 shrink-0 items-center gap-2 bg-brand px-2 text-white md:hidden">
        <button type="button" onClick={() => setDrawer(true)} aria-label="Open the menu" className={iconBtn}><Menu size={20} aria-hidden /></button>
        <Link href="/" className="inline-flex min-h-10 items-center font-semibold">Warehouse</Link>
      </div>
      {drawer && (
        <div className="no-print fixed inset-0 z-50 flex md:hidden">
          <nav aria-label="Main" className="flex h-full w-72 max-w-[85%] flex-col overflow-y-auto bg-brand pb-2 text-sm text-white shadow-xl">
            <div className="flex items-center gap-2 px-2 py-2"><button type="button" onClick={() => setDrawer(false)} aria-label="Close the menu" className={iconBtn}><X size={20} aria-hidden /></button><span className="font-semibold">Warehouse</span></div>
            {full}
          </nav>
          <button type="button" aria-label="Close the menu" onClick={() => setDrawer(false)} className="flex-1 bg-black/40" />
        </div>
      )}
      {/* Computer: sidebar, open or a rail of icons */}
      <nav aria-label="Main" className={`no-print sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto bg-brand text-sm text-white transition-[width] md:flex ${open ? "w-64 lg:w-72" : "w-14"}`}>
        <div className={`flex items-center gap-2 px-2 py-2 ${open ? "" : "justify-center"}`}>
          <button type="button" onClick={toggle} aria-label={open ? "Close the menu" : "Open the menu"} title={open ? "Close the menu" : "Open the menu"} className={iconBtn}>
            {open ? <PanelLeftClose size={19} aria-hidden /> : <PanelLeftOpen size={19} aria-hidden />}
          </button>
          {open && <span className="font-semibold tracking-wide">Warehouse</span>}
        </div>
        {open ? full : rail}
      </nav>
    </>
  );
}
