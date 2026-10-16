// Who may open which page. Pure functions (no Node or database): used by the middleware (edge) and by the server.
export type Claims = { uid: string; name: string; admin: boolean; perms: string[]; ver: string; exp: number };

export const ADMIN_ONLY = ["/settings/users", "/settings/import", "/settings/activity", "/settings/invite"]; // never granted to a limited user
export const isOn = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

// The main menu, the section pages and "my account" are open to every signed-in person (the menu only lists what they may open).
export function allowed(c: Pick<Claims, "admin" | "perms">, path: string): boolean {
  if (c.admin) return true;
  if (path === "/" || path === "/account" || path === "/no-access" || path.startsWith("/menu/") || path.startsWith("/docs/")) return true;
  if (ADMIN_ONLY.some((p) => isOn(path, p))) return false;
  return c.perms.some((p) => isOn(path, p));
}
