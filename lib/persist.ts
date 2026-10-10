// Saves the warehouse data in Postgres (Supabase or any Postgres) when DATABASE_URL is set.
// Without DATABASE_URL the app keeps everything in memory, as before (data resets on restart).
//
// How it works: the app keeps its working copy in memory (lib/wh-store.ts). On start it loads every
// table into memory; after every server action it writes back only the rows that changed.
// One row per record (customer, receipt, parcel, ...) with the record itself in a jsonb column,
// so you can browse and query the tables in the Supabase dashboard.
// Server only. Runs as a single instance: two copies of the app writing at once is not supported.
import { Pool, type PoolClient } from "pg";
import { db } from "./wh-store";

type Table = { name: string; key: (row: never) => string; rows: () => unknown[]; set: (rows: never[]) => void };
type Store = {
  pool: Pool | null; loaded: boolean; error: string | null;
  seen: Map<string, Map<string, string>>; queue: Promise<unknown>; starting: Promise<void> | null;
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
  { name: "wh_bookings", key: (b: { shipment: string }) => b.shipment, rows: () => db.bookings, set: (r) => { db.bookings = r; } },
];
// Counters and the fee-name lists are two small rows of a "meta" table.
const META = "wh_meta";
const metaRows = () => ({ n: db.n, feeNames: db.feeNames, payMethods: db.payMethods, carriers: db.carriers });

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
  for (const name of [...TABLES.map((t) => t.name), META]) {
    await c.query(`create table if not exists ${name} (k text primary key, seq bigserial, data jsonb not null, updated_at timestamptz not null default now())`);
    // The tables hold customers' personal data: Supabase exposes public tables through its REST API, so lock them to the server connection.
    await c.query(`alter table ${name} enable row level security`);
  }
}

async function load() {
  const pool = st.pool!;
  const c = await pool.connect();
  try {
    await ensureTables(c);
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
    }
    // Make sure the counters are ahead of every number already used (defence against a lost counter row).
    db.n.wr = Math.max(db.n.wr, ...db.wrs.map((w) => Number(w.id) + 1));
    db.n.piece = Math.max(db.n.piece, ...db.wrs.flatMap((w) => w.pieces.map((p) => p.no + 1)));
    db.n.item = Math.max(db.n.item, ...db.items.map((i) => i.id + 1));
    db.n.pickup = Math.max(db.n.pickup, ...db.pickups.map((p) => Number(p.id.replace(/\D/g, "")) + 1));
    db.n.cust = Math.max(db.n.cust, ...db.customers.map((x) => x.no + 1));
    seen.set(META, metaSeen);
    st.seen = seen;
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
    } catch (e) {
      st.error = e instanceof Error ? e.message : String(e);
      console.error("[persist] cannot load the database:", st.error, "- retrying every 5 seconds");
      setTimeout(() => { void initStore(); }, 5000).unref();
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

async function write() {
  const pool = st.pool;
  if (!pool || !st.loaded) return;
  let c: PoolClient | undefined;
  const next = new Map<string, Map<string, string>>();
  try {
    c = await pool.connect();
    await c.query("begin");
    const sets: [string, Map<string, string>][] = [...TABLES.map((t) => [t.name, rowsOf(t)] as [string, Map<string, string>]), [META, metaMap()]];
    for (const [name, cur] of sets) {
      const old = st.seen.get(name) ?? new Map<string, string>();
      const up = [...cur].filter(([k, json]) => old.get(k) !== json);
      const del = [...old.keys()].filter((k) => !cur.has(k));
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
