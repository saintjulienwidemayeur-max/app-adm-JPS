"use server";
import { redirect } from "next/navigation";
import { db, nowStr } from "./wh-store";
import { act } from "./act";
import { grantable } from "./menu";
import { requireAdmin, requireUser, newCredential, codeMatches, startSession, MIN_CODE } from "./users";

type F = FormData;
const s = (f: F, k: string) => String(f.get(k) ?? "").trim();
const go = (path: string, q: Record<string, string> = {}): never => redirect(Object.keys(q).length ? `${path}?${new URLSearchParams(q)}` : path);
const USERS = "/settings/users", ACCOUNT = "/account";
const okPerms = (f: F) => { const all = new Set(grantable().flatMap((g) => g.pages.map((p) => p.href))); return [...new Set(f.getAll("perm").map(String))].filter((h) => all.has(h)); };
const activeAdmins = (except?: string) => db.users.filter((u) => u.admin && u.active && u.id !== except).length;
const nameProblem = (name: string, except?: string) => {
  if (name.length < 2 || name.length > 40) return "The name must have 2 to 40 characters.";
  if (db.users.some((u) => u.id !== except && u.name.toLowerCase() === name.toLowerCase())) return `"${name}" already exists.`;
  return "";
};

export const createUser = act("createUser", async (f: F) => {
  await requireAdmin();
  const name = s(f, "name"), code = String(f.get("code") ?? ""), admin = s(f, "role") === "admin", perms = okPerms(f);
  const bad = nameProblem(name) || (code.length < MIN_CODE ? `The code needs at least ${MIN_CODE} characters.` : "") || (!admin && perms.length === 0 ? "Choose at least one page this person may open (or make them an administrator)." : "");
  if (bad) go(USERS, { err: bad });
  db.users.push({ id: `U-${db.n.user++}`, name, ...newCredential(code), admin, perms: admin ? [] : perms, active: true, created: nowStr() });
  go(USERS, { ok: `${name} was created. They sign in with their name and code.` });
});

export const saveUser = act("saveUser", async (f: F) => {
  const me = await requireAdmin();
  const u = db.users.find((x) => x.id === s(f, "id"));
  if (!u) return go(USERS);
  const name = s(f, "name"), admin = s(f, "role") === "admin", active = s(f, "active") === "yes", code = String(f.get("code") ?? ""), perms = okPerms(f);
  const bad = nameProblem(name, u.id) || (code && code.length < MIN_CODE ? `The code needs at least ${MIN_CODE} characters.` : "")
    || (!admin && perms.length === 0 ? "Choose at least one page this person may open (or make them an administrator)." : "")
    || (u.admin && u.active && (!admin || !active) && activeAdmins(u.id) === 0 ? "There must always be one active administrator." : "")
    || (u.id === me.id && !active ? "You can't deactivate yourself." : "");
  if (bad) go(USERS, { err: bad });
  Object.assign(u, { name, admin, active, perms: admin ? [] : perms });
  if (code) { Object.assign(u, newCredential(code)); u.defaultCode = false; }
  if (u.id === me.id) await startSession(u); // stay signed in after changing your own name, code or access
  go(USERS, { ok: `${name} saved.${u.id !== me.id ? " If they are signed in, the change applies the next time they open a page." : ""}` });
});

export const deleteUser = act("deleteUser", async (id: string) => {
  const me = await requireAdmin();
  const u = db.users.find((x) => x.id === id);
  if (!u) return go(USERS);
  if (u.id === me.id) go(USERS, { err: "You can't delete yourself." });
  if (u.admin && u.active && activeAdmins(u.id) === 0) go(USERS, { err: "There must always be one active administrator." });
  db.users = db.users.filter((x) => x.id !== id);
  go(USERS, { ok: `${u.name} was removed.` });
});

// Everyone can change their own code.
export const changeOwnCode = act("changeOwnCode", async (f: F) => {
  const me = await requireUser();
  const cur = String(f.get("current") ?? ""), next = String(f.get("next") ?? ""), again = String(f.get("again") ?? "");
  if (!codeMatches(me, cur)) go(ACCOUNT, { err: "The current code is wrong." });
  if (next.length < MIN_CODE) go(ACCOUNT, { err: `The new code needs at least ${MIN_CODE} characters.` });
  if (next !== again) go(ACCOUNT, { err: "The two new codes are not the same." });
  Object.assign(me, newCredential(next));
  me.defaultCode = false;
  await startSession(me);
  go(ACCOUNT, { ok: "Your code was changed." });
});
