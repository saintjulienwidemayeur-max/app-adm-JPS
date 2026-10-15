// The app's menu: five sections, like the old billing software's main menu. The sidebar, the main menu, each section's page and the
// breadcrumb all read this list, so a page is added in one place.
import { Home, Users, UserCheck, ReceiptText, Layers, PackageOpen, ScanLine, MapPin, Ship, Truck, ClipboardList, FileText, Wallet, ShoppingCart, Car, BellRing, Calculator, Banknote, type LucideIcon } from "lucide-react";

export type MenuPage = { href: string; label: string; icon: LucideIcon; desc: string };
export type MenuSection = { slug: string; title: string; icon: LucideIcon; blurb: string; pages: MenuPage[] };

export const HOME = { href: "/", label: "Main menu", icon: Home };

export const SECTIONS: MenuSection[] = [
  {
    slug: "customers", title: "Customers", icon: Users, blurb: "Customer records, quotes and pickups",
    pages: [
      { href: "/warehouse/customers", label: "Customers", icon: Users, desc: "Customer records, numbers, consignees and statements" },
      { href: "/warehouse/estimate", label: "Estimate", icon: Calculator, desc: "Price boxes by Air and Ocean, print it or make a receipt" },
      { href: "/warehouse/pickups", label: "Pickups", icon: Car, desc: "Send a driver to collect at the customer's address" },
      { href: "/warehouse/reps", label: "Reps", icon: UserCheck, desc: "Representatives assigned to customers" },
    ],
  },
  {
    slug: "receipts", title: "Warehouse Receipts", icon: ReceiptText, blurb: "Pieces, fees, notices and receipts",
    pages: [
      { href: "/warehouse/receipts", label: "Warehouse receipts", icon: ReceiptText, desc: "Pieces, fees, notices, invoices and payments of each receipt" },
      { href: "/warehouse/consolidate", label: "Consolidate", icon: Layers, desc: "Turn received parcels into JP's pieces on a receipt" },
    ],
  },
  {
    slug: "receiving", title: "Receiving & Dispatching", icon: PackageOpen, blurb: "Parcels arriving and being identified",
    pages: [
      { href: "/warehouse/prealerts", label: "Pre-alerts", icon: BellRing, desc: "Orders customers announced, and unidentified parcels" },
      { href: "/warehouse/receiving", label: "Received items", icon: PackageOpen, desc: "Scan each parcel that arrives from the carriers" },
      { href: "/warehouse/intake", label: "Intake", icon: ScanLine, desc: "Activate a parcel and print its 4x6 label" },
      { href: "/warehouse/arrivals", label: "Arrivals PV", icon: MapPin, desc: "Check in the pieces that arrived at the destination office" },
    ],
  },
  {
    slug: "shipping", title: "Prepare Shipping", icon: Ship, blurb: "Pallets, bookings and shipping documents",
    pages: [
      { href: "/warehouse/shipments", label: "Shipments", icon: Ship, desc: "Booking, Bill of Lading, Letter of Instruction, cargo list, proof of export" },
      { href: "/warehouse/pallets", label: "Load pallet", icon: Truck, desc: "Scan pieces onto a pallet or container" },
      { href: "/warehouse/loading-sheet", label: "Loading sheet", icon: ClipboardList, desc: "Print what is loaded on each pallet" },
    ],
  },
  {
    slug: "billing", title: "Billing", icon: Wallet, blurb: "Invoices, payments and orders",
    pages: [
      { href: "/warehouse/billing", label: "Billing", icon: Wallet, desc: "Receive payments and follow what is owed" },
      { href: "/warehouse/invoices", label: "Invoices", icon: FileText, desc: "Printable invoices and follow-up" },
      { href: "/warehouse/payments", label: "Payments", icon: Banknote, desc: "Payment batches and payment receipts" },
      { href: "/warehouse/orders", label: "Orders", icon: ShoppingCart, desc: "Purchase orders JP's buys for customers" },
    ],
  },
];

const on = (path: string, href: string) => path === href || path.startsWith(`${href}/`);
// The section and page a path belongs to (the hub page /menu/<slug> belongs to its section, with no page).
export function locate(path: string): { section?: MenuSection; page?: MenuPage } {
  const hub = path.match(/^\/menu\/([^/]+)/);
  if (hub) return { section: SECTIONS.find((s) => s.slug === hub[1]) };
  for (const section of SECTIONS) { const page = section.pages.find((p) => on(path, p.href)); if (page) return { section, page }; }
  return {};
}
export { on as isOn };
