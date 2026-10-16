import "./globals.css";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { Crumbs } from "@/components/crumbs";
import { menuBadges } from "@/lib/badges";
import { currentUser } from "@/lib/users";
import { db } from "@/lib/wh-store";
import { VERSION } from "@/lib/version";
import { persistState, initStore, refresh } from "@/lib/persist";

export const metadata = { title: "JP's Logistics & More" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection(); // the banner reflects the database state at request time
  const wasDown = persistState().enabled && !persistState().loaded;
  if (wasDown) await initStore(); // retry if the database was down at start
  await refresh(); // what the other app (billing) saved
  const ps = persistState();
  const reconnected = wasDown && ps.loaded; // this page was drawn from an empty copy: reload it
  const path = (await headers()).get("x-pathname") ?? "/";
  const user = path === "/login" ? null : await currentUser();
  if (path !== "/login" && !user) redirect("/login"); // cookie of someone removed or changed, or a restart
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
        <div className="flex min-h-screen"><Nav mode={mode} user={user ? { name: user.name, admin: user.admin, perms: user.perms } : null} badges={user ? menuBadges() : {}} version={VERSION} /><div className="min-w-0 flex-1"><Crumbs />{user?.admin && db.users.some((u) => u.defaultCode && u.active) && <div role="status" className="no-print bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">The administrator still has the default code. <a href="/account" className="underline">Change it now</a>.</div>}{children}</div></div>
      </body>
    </html>
  );
}
