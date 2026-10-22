// Saves the warehouse data in Postgres (Supabase or any Postgres) when DATABASE_URL is set.
// Without DATABASE_URL the app keeps everything in memory, as before (data resets on restart).
//
// How it works: the app keeps its working copy in memory (lib/wh-store.ts). On start it loads every
// table into memory; after every server action it writes back only the rows that changed.
// One row per record (customer, receipt, parcel, ...) with the record itself in a jsonb column,
// so you can browse and query the tables in the Supabase dashboard.
// Server only. Two apps can share the same database (the warehouse app and the billing app): each one calls refresh() on every request, which
// brings in the rows the other one changed (a row this app changed itself and has not saved yet is kept).
import { Pool, type PoolClient } from "pg";
import { db, keepOldFormulas } from "./wh-store";

type Table = { name: string; key: (row: never) => string; rows: () => unknown[]; set: (rows: never[]) => void };
type Store = {
  pool: Pool | null; loaded: boolean; error: string | null;
  seen: Map<string, Map<string, string>>; queue: Promise<unknown>; starting: Promise<void> | null; retry?: boolean;
  maxAt?: Map<string, number>; syncAt?: number; keysAt?: number; syncing?: boolean; lastUse?: number; timer?: boolean;
};
const g = globalThis as unknown as { __whStore?: Store };
const st: Store = (g.__whStore ??= { pool: null, loaded: false, error: null, seen: new Map(), queue: Promise.resolve(), starting: null });

export const persistEnabled = () => !!process.env.DATABASE_URL;
export const persistState = () => ({ enabled: persistEnabled(), loaded: st.loaded, error: st.error });

// Collections kept in the database. Order of loading keeps the screens in the same order as before.
const byNum = (a: string, b: string) => Number(a) - Number(b);
const TABLES: Table[] = [
  { name: "wh_customers", key: (c: { no: number }) => String(c.no), rows: () => db.customers, set: (r) => { db.customers = r; } },
  { name: "wh_reps", key: (r: { id: string }) => r.id, rows: () => db.reps, set: (r) => { db.reps = r; } },
  { name: "wh_receipts", key: (w: { id: string }) => w.id, rows: () => db.wrs, set: (r) => { db.wrs = (r as { id: string }[]).sort((a, b) => byNum(b.id, a.id)) as never; } },
  { name: "wh_items", key: (i: { id: number }) => String(i.id), rows: () => db.items, set: (r) => { db.items = r; } },
  { name: "wh_loads", key: (l: { no: number }) => String(l.no), rows: () => db.loads, set: (r) => { db.loads = r; } },
  { name: "wh_shipments", key: (s: { name: string }) => s.name, rows: () => db.shipments, set: (r) => { db.shipments = r; } },
  { name: "wh_orders", key: (o: { id: string }) => o.id, rows: () => db.orders, set: (r) => { db.orders = (r as { id: string }[]).sort((a, b) => b.id.slice(4, 6).localeCompare(a.id.slice(4, 6)) || b.id.localeCompare(a.id)) as never; } },
  { name: "wh_pickups", key: (p: { id: string }) => p.id, rows: () => db.pickups, set: (r) => { db.pickups = r; } },
  { name: "wh_prealerts", key: (p: { id: string }) => p.id, rows: () => db.prealerts, set: (r) => { db.prealerts = r; } },
  { name: "wh_users", key: (u: { id: string }) => u.id, rows: () => db.users, set: (r) => { db.users = r; } },
  { name: "wh_maillog", key: (m: { id: number }) => String(m.id), rows: () => db.maillog, set: (r) => { db.maillog = (r as { id: number }[]).sort((a, b) => b.id - a.id) as never; } },
  { name: "wh_audit", key: (a: { id: number }) => String(a.id), rows: () => db.audit, set: (r) => { db.audit = (r as { id: number }[]).sort((a, b) => b.id - a.id) as never; } },
  { name: "wh_oldinvoices", key: (o: { no: string }) => o.no, rows: () => db.oldInvoices, set: (r) => { db.oldInvoices = r; } },
  { name: "wh_oldwrs", key: (o: { wr: string }) => o.wr, rows: () => db.oldWrs, set: (r) => { db.oldWrs = r; } },
  { name: "wh_oldships", key: (o: { id: string }) => o.id, rows: () => db.oldShips, set: (r) => { db.oldShips = r; } },
  { name: "wh_bookings", key: (b: { shipment: string }) => b.shipment, rows: () => db.bookings, set: (r) => { db.bookings = r; } },
];
// Counters and the fee-name lists are two small rows of a "meta" table.
const META = "wh_meta";
const metaRows = () => ({ n: db.n, feeNames: db.feeNames, payMethods: db.payMethods, carriers: db.carriers, blockedEmails: db.blockedEmails, settings: db.settings });

const rowsOf = (t: Table) => new Map(t.rows().map((r) => [t.key(r as never), JSON.stringify(r)]));
const metaMap = () => new Map(Object.entries(metaRows()).map(([k, v]) => [k, JSON.stringify(v)]));

function makePool() {
  const url = new URL(process.env.DATABASE_URL!);
  const mode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode"); // pg would otherwise override the ssl option below
  const local = ["localhost", "127.0.0.1", "::1", ""].includes(url.hostname);
  // Supabase's pooler uses its own CA. Set DATABASE_SSL_VERIFY=1 to verify the certificate (needs NODE_EXTRA_CA_CERTS).
  const ssl = local || mode === "disable" ? false : { rejectUnauthorized: process.env.DATABASE_SSL_VERIFY === "1" };
  return new Pool({ connectionString: url.toString(), ssl, max: Number(process.env.PG_POOL_MAX ?? 4), connectionTimeoutMillis: 8000, idleTimeoutMillis: 30000 });
}

async function ensureTables(c: PoolClient) {
  // Two apps starting together would both run `create table if not exists` and one could fail: one at a time.
  await c.query("select pg_advisory_lock(7262001)");
  try { await createTables(c); } finally { await c.query("select pg_advisory_unlock(7262001)"); }
}
async function createTables(c: PoolClient) {
  // The PDFs that were e-mailed (receipts, invoices): the exact file the customer got. Not part of the in-memory copy (they are big).
  await c.query("create table if not exists wh_docs (id bigserial primary key, kind text not null, ref text not null, name text not null, note text, created_at timestamptz not null default now(), data bytea not null)");
  await c.query("alter table wh_docs enable row level security");
  await c.query("create index if not exists wh_docs_ref on wh_docs (kind, ref)");
  for (const name of [...TABLES.map((t) => t.name), META]) {
    await c.query(`create table if not exists ${name} (k text primary key, seq bigserial, data jsonb not null, updated_at timestamptz not null default now())`);
    // The tables hold customers' personal data: Supabase exposes public tables through its REST API, so lock them to the server connection.
    await c.query(`alter table ${name} enable row level security`);
    await c.query(`create index if not exists ${name}_updated on ${name} (updated_at)`); // the other app asks "what changed?" every few seconds
  }
}

async function load() {
  const pool = st.pool!;
  const c = await pool.connect();
  try {
    await ensureTables(c);
    const maxAt = await latest(c); // taken BEFORE reading the tables: what is saved while we read is picked up by the next refresh
    const seen = new Map<string, Map<string, string>>();
    for (const t of TABLES) {
      const r = await c.query<{ k: string; data: unknown }>(`select k, data from ${t.name} order by seq`);
      t.set(r.rows.map((x) => x.data) as never[]);
      seen.set(t.name, rowsOf(t));
    }
    const m = await c.query<{ k: string; data: Record<string, unknown> }>(`select k, data from ${META}`);
    const metaSeen = new Map<string, string>(); // only what is really in the database, so missing rows get written on the first save
    for (const row of m.rows) {
      metaSeen.set(row.k, JSON.stringify(row.data));
      if (row.k === "n") Object.assign(db.n, row.data);
      if (row.k === "feeNames") Object.assign(db.feeNames, row.data);
      if (row.k === "payMethods" && Array.isArray(row.data)) db.payMethods = row.data as unknown as string[];
      if (row.k === "carriers" && Array.isArray(row.data)) db.carriers = row.data as unknown as string[];
      if (row.k === "blockedEmails" && Array.isArray(row.data)) db.blockedEmails = row.data as unknown as string[];
      if (row.k === "settings") Object.assign(db.settings, row.data);
    }
    keepOldFormulas(); // saved with the next flush
    // Make sure the counters are ahead of every number already used (defence against a lost counter row).
    db.n.wr = Math.max(db.n.wr, ...db.wrs.map((w) => Number(w.id) + 1));
    db.n.piece = Math.max(db.n.piece, ...db.wrs.flatMap((w) => w.pieces.map((p) => p.no + 1)));
    db.n.item = Math.max(db.n.item, ...db.items.map((i) => i.id + 1));
    db.n.pickup = Math.max(db.n.pickup, ...db.pickups.map((p) => Number(p.id.replace(/\D/g, "")) + 1));
    db.n.prealert = Math.max(db.n.prealert, ...db.prealerts.map((p) => Number(p.id.replace(/\D/g, "")) + 1));
    db.n.mail = Math.max(db.n.mail, ...db.maillog.map((m) => m.id + 1));
    db.n.user = Math.max(db.n.user, ...db.users.map((u) => Number(u.id.replace(/\D/g, "")) + 1));
    db.n.audit = Math.max(db.n.audit, ...db.audit.map((a) => a.id + 1));
    db.n.cust = Math.max(db.n.cust, ...db.customers.map((x) => x.no + 1));
    seen.set(META, metaSeen);
    st.seen = seen;
    st.maxAt = maxAt;
  } finally { c.release(); }
}

// Connects and loads the data. Safe to call again after a failure.
export function initStore(): Promise<void> {
  if (!persistEnabled() || st.loaded) return Promise.resolve();
  return (st.starting ??= (async () => {
    try {
      st.pool ??= makePool();
      await load();
      st.loaded = true; st.error = null;
      console.log("[persist] database ready");
      if (!st.timer) { st.timer = true; setInterval(() => { if (Date.now() - (st.lastUse ?? 0) < 1800000) void refresh(true); }, 5000).unref(); } // keeps the working copy fresh between requests, while the app is in use
    } catch (e) {
      st.error = e instanceof Error ? e.message : String(e);
      // One retry timer at a time (every page visit calls initStore too: without this the timers and the log lines pile up).
      if (!st.retry) {
        st.retry = true;
        console.error("[persist] cannot load the database:", st.error, "- retrying every 5 seconds");
        setTimeout(() => { st.retry = false; void initStore(); }, 5000).unref();
      }
    } finally { st.starting = null; }
  })());
}

// Called before every server action. If the database is configured but unreachable the action is refused:
// working on an empty copy and saving it later would overwrite real data.
export async function ensureLoaded() {
  if (!persistEnabled() || st.loaded) return;
  await initStore();
  if (!st.loaded) throw new Error(`The database is not reachable, so nothing was changed. ${st.error ?? ""}`.trim());
}

// Like ensureLoaded, for pages that only read: false instead of an error when the database is down (the page then shows what it has).
export async function tryLoaded(): Promise<boolean> {
  try { await ensureLoaded(); return true; } catch { return false; }
}

async function write() {
  const pool = st.pool;
  if (!pool || !st.loaded) return;
  let c: PoolClient | undefined;
  const next = new Map<string, Map<string, string>>();
  try {
    // First find what changed, without touching the database: most pages change nothing, and then there is nothing to do.
    const sets: [string, Map<string, string>][] = [...TABLES.map((t) => [t.name, rowsOf(t)] as [string, Map<string, string>]), [META, metaMap()]];
    const work = sets.map(([name, cur]) => {
      const old = st.seen.get(name) ?? new Map<string, string>();
      return { name, cur, up: [...cur].filter(([k, json]) => old.get(k) !== json), del: [...old.keys()].filter((k) => !cur.has(k)) };
    });
    if (work.every((w) => !w.up.length && !w.del.length)) return;
    c = await pool.connect();
    await c.query("begin");
    for (const { name, cur, up, del } of work) {
      if (up.length) await c.query(`insert into ${name} (k, data) select * from unnest($1::text[], $2::jsonb[]) on conflict (k) do update set data = excluded.data, updated_at = now()`, [up.map(([k]) => k), up.map(([, j]) => j)]);
      if (del.length) await c.query(`delete from ${name} where k = any($1::text[])`, [del]);
      next.set(name, cur);
    }
    await c.query("commit");
    st.seen = next;
    st.error = null;
  } catch (e) {
    await c?.query("rollback").catch(() => {});
    st.error = e instanceof Error ? e.message : String(e);
    console.error("[persist] save failed (will retry on the next change):", st.error);
  } finally { c?.release(); }
}

// Writes the rows that changed since the last save. Saves never run at the same time.
export function flush(): Promise<void> {
  if (!st.pool || !st.loaded) return Promise.resolve();
  const p = st.queue.then(write, write);
  st.queue = p;
  return p as Promise<void>;
}

// The newest change of every table, in one cheap query (each table has an index on updated_at).
async function latest(c: PoolClient): Promise<Map<string, number>> {
  const q = [...TABLES.map((t) => t.name), META].map((n) => `select '${n}' as t, max(updated_at) as m from ${n}`).join(" union all ");
  return new Map((await c.query<{ t: string; m: Date | null }>(q)).rows.map((r) => [r.t, r.m ? r.m.getTime() : 0]));
}

// Brings in what the other app wrote to the database since the last look (at most every 3 seconds, and every 5 seconds in the background).
// Rows this app changed and has not saved yet are kept. Counters take the larger value, so two apps never give out the same number.
export async function refresh(background = false): Promise<void> {
  const pool = st.pool;
  if (!background) st.lastUse = Date.now();
  if (!pool || !st.loaded || st.syncing || Date.now() - (st.syncAt ?? 0) < (background ? 2500 : 3000)) return;
  st.syncing = true; st.syncAt = Date.now();
  let c: PoolClient | undefined;
  try {
    c = await pool.connect();
    const now = await latest(c), before = st.maxAt ?? new Map<string, number>();
    const reconcile = Date.now() - (st.keysAt ?? 0) > 60000;
    for (const t of TABLES) {
      const moved = (now.get(t.name) ?? 0) > (before.get(t.name) ?? 0);
      if (!moved && !reconcile) continue;
      const seen = st.seen.get(t.name) ?? new Map<string, string>();
      const local = new Map((t.rows() as unknown[]).map((r) => [t.key(r as never), r]));
      let changed = false;
      if (moved) {
        const since = new Date((before.get(t.name) ?? 0) - 10000); // a margin: a save that started before our last look may have committed after it
        const r = await c.query<{ k: string; data: unknown }>(`select k, data from ${t.name} where updated_at > $1 order by seq`, [since]);
        for (const row of r.rows) {
          const json = JSON.stringify(row.data), mine = local.get(row.k);
          if (mine !== undefined && JSON.stringify(mine) !== seen.get(row.k)) continue; // changed here and not saved yet
          if (mine !== undefined && json === seen.get(row.k)) continue; // nothing new
          local.set(row.k, row.data); seen.set(row.k, json); changed = true;
        }
      }
      if (reconcile) {
        const keys = new Set((await c.query<{ k: string }>(`select k from ${t.name}`)).rows.map((x) => x.k));
        for (const [k, v] of [...local]) if (!keys.has(k) && JSON.stringify(v) === seen.get(k)) { local.delete(k); seen.delete(k); changed = true; }
      }
      if (changed) { t.set([...local.values()] as never[]); st.seen.set(t.name, seen); }
    }
    if ((now.get(META) ?? 0) > (before.get(META) ?? 0)) {
      const metaSeen = st.seen.get(META) ?? new Map<string, string>();
      const m = await c.query<{ k: string; data: Record<string, unknown> }>(`select k, data from ${META} where updated_at > $1`, [new Date((before.get(META) ?? 0) - 10000)]);
      for (const row of m.rows) {
        if (row.k === "n") { for (const [k, v] of Object.entries(row.data)) if (typeof v === "number") (db.n as Record<string, number>)[k] = Math.max((db.n as Record<string, number>)[k] ?? 0, v); metaSeen.set("n", JSON.stringify(row.data)); continue; }
        const mineJson = JSON.stringify((metaRows() as Record<string, unknown>)[row.k]);
        if (mineJson !== metaSeen.get(row.k) && metaSeen.has(row.k)) continue;
        if (row.k === "feeNames") Object.assign(db.feeNames, row.data);
        if (row.k === "payMethods" && Array.isArray(row.data)) db.payMethods = row.data as unknown as string[];
        if (row.k === "carriers" && Array.isArray(row.data)) db.carriers = row.data as unknown as string[];
        if (row.k === "blockedEmails" && Array.isArray(row.data)) db.blockedEmails = row.data as unknown as string[];
        if (row.k === "settings") Object.assign(db.settings, row.data);
        metaSeen.set(row.k, JSON.stringify(row.data));
      }
      st.seen.set(META, metaSeen);
    }
    keepOldFormulas();
    if (reconcile) st.keysAt = Date.now();
    st.maxAt = now;
  } catch (e) {
    console.error("[persist] refresh failed:", e instanceof Error ? e.message : e);
  } finally { c?.release(); st.syncing = false; }
}

// ---------- Documents (PDF) that were sent ----------
export type DocInfo = { id: string; kind: string; ref: string; name: string; note: string; created: string };
const memDocs = ((globalThis as unknown as { __whDocs?: Map<string, DocInfo & { data: Buffer }> }).__whDocs ??= new Map());
let memSeq = 1;
export async function saveDoc(d: { kind: string; ref: string; name: string; note?: string; data: Uint8Array }): Promise<string> {
  const pool = st.pool;
  if (pool && st.loaded) {
    const r = await pool.query<{ id: string }>("insert into wh_docs (kind, ref, name, note, data) values ($1,$2,$3,$4,$5) returning id::text", [d.kind, d.ref, d.name, d.note ?? "", Buffer.from(d.data)]);
    return r.rows[0].id;
  }
  const id = `m${memSeq++}`;
  memDocs.set(id, { id, kind: d.kind, ref: d.ref, name: d.name, note: d.note ?? "", created: new Date().toISOString(), data: Buffer.from(d.data) });
  return id;
}
export async function getDoc(id: string): Promise<(DocInfo & { data: Buffer }) | null> {
  if (id.startsWith("m")) return memDocs.get(id) ?? null;
  if (!st.pool || !st.loaded || !/^\d+$/.test(id)) return null;
  const r = await st.pool.query("select id::text, kind, ref, name, coalesce(note,'') as note, created_at, data from wh_docs where id = $1", [id]);
  const x = r.rows[0];
  return x ? { id: x.id, kind: x.kind, ref: x.ref, name: x.name, note: x.note, created: new Date(x.created_at).toISOString(), data: x.data } : null;
}
export async function listDocs(kind: string, ref: string): Promise<DocInfo[]> {
  if (st.pool && st.loaded) {
    const r = await st.pool.query("select id::text, kind, ref, name, coalesce(note,'') as note, created_at from wh_docs where kind = $1 and ref = $2 order by id desc limit 50", [kind, ref]);
    return r.rows.map((x) => ({ id: x.id, kind: x.kind, ref: x.ref, name: x.name, note: x.note, created: new Date(x.created_at).toISOString() }));
  }
  return [...memDocs.values()].filter((d) => d.kind === kind && d.ref === ref).map(({ data: _d, ...i }) => i).reverse();
}
