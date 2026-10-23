"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { locate } from "@/lib/menu";

// Where you are: Main menu > Section > Page. Also the way around on a narrow screen, where the sidebar is hidden.
export function Crumbs() {
  const path = usePathname();
  if (path === "/login" || path === "/") return null;
  const { section, page } = locate(path);
  const Sep = () => <ChevronRight size={14} aria-hidden className="text-zinc-400" />;
  return (
    <div className="no-print border-b border-[#dfe4f0] bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1.5 px-4 py-0.5 text-sm">
        <Link href="/" className="flex min-h-9 items-center gap-1 text-zinc-600 hover:text-brand"><Home size={14} aria-hidden /> Main menu</Link>
        {section && <><Sep /><Link href={`/menu/${section.slug}`} className={`inline-flex min-h-9 items-center ${page ? "text-zinc-600 hover:text-brand" : "font-semibold text-brand"}`}>{section.title}</Link></>}
        {page && <><Sep /><Link href={page.href} className="inline-flex min-h-9 items-center font-semibold text-brand">{page.label}</Link></>}
      </div>
    </div>
  );
}
