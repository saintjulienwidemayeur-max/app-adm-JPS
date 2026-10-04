import "./globals.css";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { Nav } from "@/components/nav";
import { persistState, initStore } from "@/lib/persist";

export const metadata = { title: "JP's Logistics & More" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection(); // the banner reflects the database state at request time
  const wasDown = persistState().enabled && !persistState().loaded;
  if (wasDown) await initStore(); // retry if the database was down at start
  const ps = persistState();
  const reconnected = wasDown && ps.loaded; // this page was drawn from an empty copy: reload it
  const mode = !ps.enabled ? "memory" : ps.loaded ? "database" : "down";
  return (
    <html lang="en">
      <body>
        {reconnected && <meta httpEquiv="refresh" content="1" />}
        {reconnected && <div role="status" className="no-print bg-green-700 px-4 py-2 text-center text-sm font-medium text-white">The database is back. Reloading…</div>}
        {(mode === "down" || (mode === "database" && ps.error)) && (
          <div role="alert" className="no-print bg-red-700 px-4 py-2 text-center text-sm font-medium text-white">
            {mode === "down" ? "The database is not reachable: nothing can be saved right now." : "The last save to the database failed. It will be retried with the next change."}
          </div>
        )}
        <div className="flex min-h-screen"><div className="min-w-0 flex-1">{children}</div><Nav mode={mode} auth={!!process.env.APP_PASSWORD} /></div>
      </body>
    </html>
  );
}
