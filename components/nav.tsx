"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PackageOpen, ReceiptText, ScanLine, Truck, ClipboardList, MapPin, Layers } from "lucide-react";

const links = [
  ["/warehouse/intake", "Intake", ScanLine], ["/warehouse/receiving", "Received items", PackageOpen],
  ["/warehouse/consolidate", "Consolidate", Layers], ["/warehouse/receipts", "Warehouse receipts", ReceiptText], ["/warehouse/pallets", "Load pallet", Truck],
  ["/warehouse/loading-sheet", "Loading sheet", ClipboardList], ["/warehouse/arrivals", "Arrivals PV", MapPin],
] as const;

export function Nav() {
  const path = usePathname();
  return (
    <nav className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-1 self-start border-l border-[#dfe4f0] bg-white p-4 text-sm">
      <Link href="/warehouse/receiving" className="mb-5 block px-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JP's Logistics & More" className="w-full" />
      </Link>
      {links.map(([href, label, Icon]) => {
        const on = path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition ${on ? "bg-brand text-white shadow-sm" : "text-zinc-700 hover:bg-[#eaeefb] hover:text-brand"}`}>
            <Icon size={18} aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
