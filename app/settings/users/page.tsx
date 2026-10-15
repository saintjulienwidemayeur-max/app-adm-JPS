import { db } from "@/lib/wh-store";
import { grantable } from "@/lib/menu";
import { requireAdmin } from "@/lib/users";
import { createUser, saveUser, deleteUser } from "@/lib/user-actions";
import { AccessPicker } from "@/components/access-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Users & access · JP's Logistics" };
export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;
const th = "px-2 py-1 font-semibold", td = "px-2 py-1 align-top";
const F = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="grid gap-1 text-xs font-medium text-zinc-600">{label}{children}</label>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const me = await requireAdmin(), q = await searchParams, groups = grantable();
  const total = groups.reduce((a, g) => a + g.pages.length, 0);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1>Users &amp; access</h1>
      <p className="text-sm text-zinc-600">Create the people who sign in with a name and a code, and choose the pages each may open. An administrator opens everything and manages the users. Change the administrator&apos;s name or code here whenever you want.</p>
      {q.err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{q.err}</p>}
      {q.ok && <p className="mt-2 text-sm font-medium text-green-700">{q.ok}</p>}

      <table className="mt-4 w-full text-left text-sm">
        <thead><tr>{["Name", "Role", "Access", "Last sign-in", "Status", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{db.users.map((u) => (
          <tr key={u.id} className="border-b border-zinc-100">
            <td className={`${td} font-semibold`}>{u.name}{u.id === me.id && <span className="ml-1 text-xs font-normal text-zinc-500">(you)</span>}</td>
            <td className={td}>{u.admin ? "Administrator" : "User"}</td>
            <td className={td}>{u.admin ? "Everything" : `${u.perms.length} of ${total} pages`}</td>
            <td className={td}>{u.lastLogin ?? "–"}</td>
            <td className={`${td} font-medium ${u.active ? "text-green-700" : "text-zinc-500"}`}>{u.active ? "Active" : "Deactivated"}</td>
            <td className={td}>
              <details><summary className="cursor-pointer text-brand underline">Edit</summary>
                <form action={saveUser} className="mt-2 grid w-[min(52rem,80vw)] gap-3 rounded-lg border bg-white p-3">
                  <input type="hidden" name="id" value={u.id} />
                  <div className="grid gap-2 sm:grid-cols-4">
                    <F label="Name (used to sign in)"><Input name="name" defaultValue={u.name} maxLength={40} required /></F>
                    <F label="New code (leave empty to keep)"><Input name="code" type="password" autoComplete="new-password" /></F>
                    <F label="Role"><select name="role" defaultValue={u.admin ? "admin" : "user"} className="h-9 w-full rounded-md border bg-white px-2 text-sm"><option value="user">User: only the pages chosen</option><option value="admin">Administrator: everything</option></select></F>
                    <F label="Status"><select name="active" defaultValue={u.active ? "yes" : "no"} className="h-9 w-full rounded-md border bg-white px-2 text-sm"><option value="yes">Active</option><option value="no">Deactivated</option></select></F>
                  </div>
                  <div><div className="mb-1 text-xs font-medium text-zinc-600">Pages this user may open{u.admin ? " (not used: administrators open everything)" : ""}</div><AccessPicker groups={groups} selected={u.perms} /></div>
                  <div className="flex items-center gap-3"><Button type="submit">Save</Button>
                    {u.id !== me.id && <button formAction={deleteUser.bind(null, u.id)} formNoValidate className="text-red-700 underline">Remove this user</button>}</div>
                </form>
              </details>
            </td>
          </tr>))}</tbody>
      </table>

      <form action={createUser} className="mt-6 grid gap-3 rounded-lg border p-3">
        <h2 className="font-bold">New user</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <F label="Name (used to sign in)"><Input name="name" maxLength={40} placeholder="For example Patrick" required /></F>
          <F label="Code (at least 4 characters)"><Input name="code" type="password" autoComplete="new-password" required /></F>
          <F label="Role"><select name="role" defaultValue="user" className="h-9 w-full rounded-md border bg-white px-2 text-sm"><option value="user">User: only the pages chosen</option><option value="admin">Administrator: everything</option></select></F>
        </div>
        <div><div className="mb-1 text-xs font-medium text-zinc-600">Which pages may this person open?</div><AccessPicker groups={groups} selected={[]} /></div>
        <Button type="submit" className="w-40">Create the user</Button>
      </form>
    </main>
  );
}
