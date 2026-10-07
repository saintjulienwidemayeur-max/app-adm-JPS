"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth";
import { PackageOpen, ReceiptText, ScanLine, Truck, ClipboardList, MapPin, Layers, Users, UserCheck, FileText, Ship, Wallet } from "lucide-react";

const links = [
  ["/warehouse/intake", "Intake", ScanLine], ["/warehouse/receiving", "Received items", PackageOpen],
  ["/warehouse/consolidate", "Consolidate", Layers], ["/warehouse/receipts", "Warehouse receipts", ReceiptText], ["/warehouse/pallets", "Load pallet", Truck], ["/warehouse/shipments", "Shipments", Ship],
  ["/warehouse/loading-sheet", "Loading sheet", ClipboardList], ["/warehouse/arrivals", "Arrivals PV", MapPin],
  ["/warehouse/invoices", "Invoices", FileText], ["/warehouse/billing", "Billing", Wallet], ["/warehouse/customers", "Customers", Users], ["/warehouse/reps", "Reps", UserCheck],
] as const;

export function Nav({ mode = "memory", auth = false }: { mode?: "memory" | "database" | "down"; auth?: boolean }) {
  const path = usePathname();
  if (path === "/login") return null;
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
      {auth && <form action={logout} className="mt-auto"><button className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-600 hover:bg-[#eaeefb] hover:text-brand">Sign out</button></form>}
      <p className={`${auth ? "" : "mt-auto "}px-3 text-xs ${mode === "memory" ? "text-amber-700" : mode === "down" ? "text-red-700" : "text-zinc-500"}`}>
        {mode === "memory" ? "Memory only: data is lost when the server restarts." : mode === "down" ? "Database not reachable." : "Saved in the database."}
      </p>
    </nav>
  );
}
