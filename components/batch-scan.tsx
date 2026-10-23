"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { CameraScan } from "@/components/camera-scan";

// Received items, many parcels in one go: choose the customer once (or none), scan every parcel (it only goes on the list below, nothing is saved yet),
// then "Finish and save" sends them all together. A light shows whether the scanner can type here (green) or not (red).
// The list survives a page refresh (this tab only) until it is saved: if the save is refused (for example a wrong customer name), the list is still there.
const KEY = "jps_rcv_pending";
export function BatchScan({ action, customerListId }: { action: (fd: FormData) => void | Promise<void>; customerListId: string }) {
  const inp = useRef<HTMLInputElement>(null), times = useRef<number[]>([]), timer = useRef<number | undefined>(undefined);
  const sp = useSearchParams();
  const [codes, setCodes] = useState<string[]>([]), [customer, setCustomer] = useState(""), [focus, setFocus] = useState(false), [note, setNote] = useState(""), [ready, setReady] = useState(false);
  useEffect(() => {
    try { const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null"); if (v) { setCodes(v.codes ?? []); setCustomer(v.customer ?? ""); } } catch { /* nothing saved */ }
    setReady(true); if (document.activeElement === inp.current) setFocus(true);
  }, []);
  useEffect(() => { if (ready) try { sessionStorage.setItem(KEY, JSON.stringify({ codes, customer })); } catch { /* private mode */ } }, [codes, customer, ready]);
  // Saved (the page says how many): the list is done. A refused save (only an error) keeps the list.
  // `t` is different at every save, so a refresh of that same page does not empty a list scanned afterwards.
  const saved = sp.get("info") ? sp.get("t") ?? "x" : "";
  useEffect(() => {
    if (!saved) return;
    try { if (sessionStorage.getItem(KEY + "_t") === saved) return; sessionStorage.setItem(KEY + "_t", saved); sessionStorage.removeItem(KEY); } catch { /* private mode */ }
    setCodes([]); setCustomer("");
  }, [saved]);
  const add = () => {
    const el = inp.current; if (!el) return;
    const v = el.value.trim(); times.current = [];
    if (v.length < 6) { setNote(`"${v}" is too short to be a tracking number: it was not added. Scan it again.`); return; }
    el.value = "";
    setCodes((c) => { if (c.includes(v)) { setNote(`${v} is already on the list.`); return c; } setNote(""); return [...c, v]; });
    el.focus();
  };
  const [nb, setNb] = useState(1);
  const addBlank = () => setCodes((c) => { const base = c.filter((x) => x.startsWith("*NOTRACK*")).length; return [...c, ...Array.from({ length: Math.max(1, Math.min(50, nb)) }, (_, i) => `*NOTRACK*${base + i + 1}`)]; });
  const show = (c: string) => (c.startsWith("*NOTRACK*") ? `No tracking number (JPS makes one) #${c.slice(9)}` : c);
  const onInput = () => {
    times.current.push(Date.now()); window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { const t = times.current; if (t.length === 1 || (t.length >= 6 && (t[t.length - 1] - t[0]) / (t.length - 1) < 45)) add(); }, 160);
  };
  return (
    <form action={action} className="mt-3 grid gap-3">
      <input type="hidden" name="codes" value={codes.join("\n")} />
      <label className="grid gap-1 text-xs font-semibold text-zinc-700">Whose parcels are these? <span className="font-normal text-zinc-500">(optional: type a name or a number and pick the customer ONCE for the whole list; leave it empty if you do not know)</span>
        <input name="customer" list={customerListId} value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer: name or number" autoComplete="off" className="h-9 w-full max-w-xl rounded-md border border-zinc-300 bg-white px-3 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-zinc-700">Scan the parcels
        <span className="flex flex-wrap items-center gap-2">
          <input ref={inp} id="tracking" placeholder="Scan a tracking number: it goes on the list" autoFocus autoComplete="off" spellCheck={false} className="h-9 min-w-60 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm"
            onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); times.current = []; }} onInput={onInput}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); window.clearTimeout(timer.current); add(); } }} />
          <CameraScan target="tracking" />
          <span role="status" aria-live="polite" className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${focus ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${focus ? "bg-green-600" : "bg-red-600"}`} />{focus ? "Scanner ready" : "Scanner off: click the field"}
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-semibold text-zinc-700">A box with no tracking number (nothing to scan)?</span>
        <input type="number" min={1} max={50} value={nb} onChange={(e) => setNb(Number(e.target.value) || 1)} aria-label="Number of boxes with no tracking number" className="h-9 w-16 rounded-md border border-zinc-300 bg-white px-2 text-right text-sm" />
        <button type="button" onClick={addBlank} className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium hover:bg-zinc-100">Add with a number made by the system</button>
      </div>
      {note && <p role="alert" className="text-sm font-semibold text-amber-700">{note}</p>}
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2"><span className="text-3xl font-extrabold leading-none text-brand" aria-live="polite">{codes.length}</span><span className="text-xs text-zinc-600">parcel{codes.length === 1 ? "" : "s"} on the list, not saved yet</span></div>
          <div className="flex gap-2">
            {codes.length > 0 && <button type="button" onClick={() => { if (confirm("Empty the list without saving?")) setCodes([]); }} className="text-xs text-red-700 underline">Empty the list</button>}
            <button type="submit" disabled={!codes.length} className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-white disabled:opacity-40">Finish and save {codes.length > 0 ? codes.length : ""}</button>
          </div>
        </div>
        {codes.length > 0 && <ul className="mt-2 grid max-h-56 gap-0.5 overflow-auto font-mono text-xs sm:grid-cols-2">{[...codes].reverse().map((c, i) => <li key={c} className="flex items-center justify-between gap-2 rounded bg-white px-2 py-0.5"><span>{codes.length - i}. {show(c)}</span><button type="button" onClick={() => setCodes((l) => l.filter((x) => x !== c))} aria-label={`Remove ${c}`} className="text-zinc-400 hover:text-red-700"><X size={12} /></button></li>)}</ul>}
      </div>
    </form>
  );
}
