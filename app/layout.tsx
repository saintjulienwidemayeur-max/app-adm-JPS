import "./globals.css";
import type { ReactNode } from "react";
import { Nav } from "@/components/nav";

export const metadata = { title: "JP's Logistics & More" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><div className="flex min-h-screen"><div className="min-w-0 flex-1">{children}</div><Nav /></div></body>
    </html>
  );
}
