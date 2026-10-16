// The app's menu: five sections, like the old billing software's main menu. The sidebar, the main menu, each section's page and the
// breadcrumb all read this list, so a page is added in one place.
import { allowed, isOn, type Claims } from "./access";
import { Home, Users, UserCheck, ReceiptText, Layers, PackageOpen, MapPin, Ship, Truck, ClipboardList, FileText, Wallet, ShoppingCart, Car, BellRing, Calculator, Banknote, ShieldCheck, Mail, FileUp, History, UserPlus, ExternalLink, type LucideIcon } from "lucide-react";

export type MenuPage = { href: string; label: string; icon: LucideIcon; desc: string; adminOnly?: boolean };
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
    slug: "billing", title: "Billing", icon: Wallet, blurb: "Receive payments; invoicing is in the billing system",
    pages: [
      { href: "/warehouse/payments", label: "Receive payments", icon: Banknote, desc: "Receive a payment from a customer and print the payment receipt" },
      { href: "/billing", label: "Billing system", icon: ExternalLink, desc: "Invoices, receivables, reports, payables and old invoices (opens the billing system)" },
    ],
  },
  {
    slug: "admin", title: "Administration", icon: ShieldCheck, blurb: "Users, access and e-mails to customers",
    pages: [
      { href: "/settings/users", label: "Users & access", icon: ShieldCheck, desc: "Create the people who sign in and choose the pages each may open", adminOnly: true },
      { href: "/settings/invite", label: "Invite customers", icon: UserPlus, desc: "Open each customer's account on the website and e-mail the temporary password (100 a day)", adminOnly: true },
      { href: "/settings/activity", label: "Activity log", icon: History, desc: "Everything each person does in the app", adminOnly: true },
      { href: "/settings/import", label: "Import data", icon: FileUp, desc: "Bring the customers of the old system in from a CSV file", adminOnly: true },
      { href: "/settings/email", label: "Email customers", icon: Mail, desc: "Send an e-mail through the website to all, to a shipment's customers or to chosen people" },
    ],
  },
];

const on = isOn;
// The section and page a path belongs to (the hub page /menu/<slug> belongs to its section, with no page).
export function locate(path: string): { section?: MenuSection; page?: MenuPage } {
  const hub = path.match(/^\/menu\/([^/]+)/);
  if (hub) return { section: SECTIONS.find((s) => s.slug === hub[1]) };
  for (const section of SECTIONS) { const page = section.pages.find((p) => on(path, p.href)); if (page) return { section, page }; }
  return {};
}
export { isOn };
// What this person sees in the menu: only the pages they may open, and no empty section.
export const visibleSections = (c: Pick<Claims, "admin" | "perms">): MenuSection[] =>
  SECTIONS.map((s) => ({ ...s, pages: s.pages.filter((p) => allowed(c, p.href)) })).filter((s) => s.pages.length > 0);
// Every page a limited user can be given (grouped by section), for the access picker.
export const grantable = (): { slug: string; title: string; pages: { href: string; label: string }[] }[] =>
  SECTIONS.map((s) => ({ slug: s.slug, title: s.title, pages: s.pages.filter((p) => !p.adminOnly).map((p) => ({ href: p.href, label: p.label })) })).filter((s) => s.pages.length > 0);
