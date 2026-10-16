"use server";
import { redirect } from "next/navigation";
import { ensureLoaded, flush } from "./persist";
import { requireAdmin } from "./users";
import { logAudit } from "./audit";
import { decodeCsv, readLines, importLines } from "./customer-import";
import { readBilling } from "./billing-import";
import { db } from "./wh-store";

const PAGE = "/settings/import";
const MAX_BYTES = 8 * 1024 * 1024;
const to = (q: Record<string, string>) => `${PAGE}?${new URLSearchParams(q)}`;

// "Check the file" (dry run) or "Import" (saves). Administrators only.
export async function importCustomers(f: FormData) {
  await ensureLoaded();
  const admin = await requireAdmin();
  const dry = f.get("mode") !== "import", overwrite = f.get("overwrite") === "yes";
  const run = async (): Promise<string> => {
    const file = f.get("file");
    if (!(file instanceof File) || file.size === 0) return to({ err: "Choose the CSV file first." });
    if (file.size > MAX_BYTES) return to({ err: "The file is too big (8 MB at most)." });
    const { lines, problems } = readLines(decodeCsv(await file.arrayBuffer()));
    if (!lines.length) return to({ err: problems[0] ?? "No customer found in the file." });
    const r = importLines(lines, overwrite, dry);
    logAudit(admin.name, dry ? "check customer file" : "import customers", `${r.total} lines`, `${r.added} added, ${r.updated} updated, ${r.conflicts.length} skipped`);
    return to({
      done: dry ? "check" : "import", total: String(r.total), added: String(r.added), updated: String(r.updated), unchanged: String(r.unchanged),
      conflicts: String(r.conflicts.length), problems: String(problems.length), detail: [...r.conflicts, ...problems].slice(0, 8).join(" | "),
    });
  };
  let target: string;
  try { target = await run(); } catch (e) { target = to({ err: `The file could not be read: ${e instanceof Error ? e.message : e}` }); }
  await flush(); // the customers are saved in the database
  redirect(target);
}

// The old invoices: 4 CSV files, "Check" (saves nothing) or "Import" (replaces the old invoices already here). Administrators only.
export async function importOldBilling(f: FormData) {
  await ensureLoaded();
  const admin = await requireAdmin();
  const dry = f.get("mode") !== "import";
  const run = async (): Promise<string> => {
    const text = async (k: string) => { const x = f.get(k); return x instanceof File && x.size > 0 ? decodeCsv(await x.arrayBuffer()) : null; };
    const [invoices, lines, payments, apps] = [await text("invoices"), await text("lines"), await text("payments"), await text("apps")];
    if (!invoices || !lines || !payments || !apps) return to({ berr: "Choose the 4 files: invoices, invoice lines, payments and payment applications." });
    const { list, result, error } = readBilling({ invoices, lines, payments, apps });
    if (error) return to({ berr: error });
    if (!dry) db.oldInvoices = list;
    logAudit(admin.name, dry ? "check old invoices" : "import old invoices", `${result.invoices} invoices, ${result.payments} payments`, `${result.open} open, $${result.owed} owed`);
    return to({ bdone: dry ? "check" : "import", bi: String(result.invoices), bl: String(result.lines), bp: String(result.payments), bo: String(result.open), bw: String(result.owed), bu: String(result.unknownCustomers), bx: result.problems.join(" | ") });
  };
  let target: string;
  try { target = await run(); } catch (e) { target = to({ berr: `The files could not be read: ${e instanceof Error ? e.message : e}` }); }
  await flush();
  redirect(target);
}
