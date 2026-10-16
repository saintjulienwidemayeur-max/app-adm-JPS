"use server";
import { redirect } from "next/navigation";
import { ensureLoaded, flush } from "./persist";
import { requireAdmin } from "./users";
import { logAudit } from "./audit";
import { decodeCsv, readLines, importLines } from "./customer-import";
import { readCargo } from "./cargo-import";
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

// The cargo history: 5 CSV files, "Check" (saves nothing) or "Import" (replaces the old cargo history already here). Administrators only.
export async function importCargo(f: FormData) {
  await ensureLoaded();
  const admin = await requireAdmin();
  const dry = f.get("mode") !== "import";
  const run = async (): Promise<string> => {
    const text = async (k: string) => { const x = f.get(k); return x instanceof File && x.size > 0 ? decodeCsv(await x.arrayBuffer()) : null; };
    const [receipts, pieces, scans, ships, shipPieces] = [await text("receipts"), await text("pieces"), await text("scans"), await text("ships"), await text("shipPieces")];
    if (!receipts || !pieces || !scans || !ships || !shipPieces) return to({ cerr: "Choose the 5 files: receipts, pieces, scanned parcels, shipments and shipment pieces." });
    const { wrs, ships: list, result, error } = readCargo({ receipts, pieces, scans, ships, shipPieces });
    if (error) return to({ cerr: error });
    if (!dry) { db.oldWrs = wrs; db.oldShips = list; }
    logAudit(admin.name, dry ? "check cargo history" : "import cargo history", `${result.receipts} receipts, ${result.pieces} pieces, ${result.scans} scans, ${result.ships} shipments`, "ok");
    return to({ cdone: dry ? "check" : "import", cr: String(result.receipts), cp: String(result.pieces), cs: String(result.scans), ch: String(result.ships), cl: String(result.shipPieces), cx: result.problems.join(" | ") });
  };
  let target: string;
  try { target = await run(); } catch (e) { target = to({ cerr: `The files could not be read: ${e instanceof Error ? e.message : e}` }); }
  await flush();
  redirect(target);
}
