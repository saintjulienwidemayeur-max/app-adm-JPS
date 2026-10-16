import type { MetadataRoute } from "next";

// Makes the app installable (PWA): "Install app" in the browser, or "Add to Home Screen" on a phone or tablet.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JP's Logistics & More: Warehouse",
    short_name: "JP's Warehouse",
    description: "Warehouse receipts, parcels, shipments and payments of JP's Logistics & More.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f3f5fa",
    theme_color: "#20338f",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Received items", url: "/warehouse/receiving" },
      { name: "Consolidate", url: "/warehouse/consolidate" },
      { name: "Receive payments", url: "/warehouse/payments" },
    ],
  };
}
