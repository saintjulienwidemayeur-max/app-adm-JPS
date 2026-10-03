"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useReactToPrint } from "react-to-print";
import { Camera, CheckCircle2, ScanLine, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { calcPricing } from "@/lib/pricing";
import { ParcelLabel } from "@/components/parcel-label";
import { scanParcel, activateParcel, type LabelData } from "./actions";

type Log = { id: number; tone: "ok" | "warn" | "err"; text: string };
const empty = { senderName: "", senderPhone: "", receiverName: "", receiverPhone: "", destination: "", weight: "", l: "", w: "", h: "" };

export function IntakeClient() {
  const scanRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [shelf, setShelf] = useState("");
  const [tracking, setTracking] = useState<string | null>(null); // modal opens when set
  const [form, setForm] = useState(empty);
  const [label, setLabel] = useState<LabelData | null>(null);
  const [log, setLog] = useState<Log[]>([]);
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const refocus = () => setTimeout(() => scanRef.current?.focus(), 50);
  const print = useReactToPrint({ contentRef: labelRef, onAfterPrint: () => { setLabel(null); refocus(); } });
  const push = (tone: Log["tone"], text: string) => setLog((l) => [{ id: Date.now(), tone, text }, ...l].slice(0, 8));

  // Auto-print once the label has mounted.
  useEffect(() => { if (label) { const t = setTimeout(print, 150); return () => clearTimeout(t); } }, [label, print]);

  // "/" jumps back to the scanner.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault(); scanRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleScan = useCallback((code: string) => {
    if (!code.trim()) return;
    setValue("");
    start(async () => {
      const r = await scanParcel(code, shelf);
      if (r.kind === "new") { setForm(empty); setError(""); setTracking(r.tracking); }
      else if (r.kind === "activated") push("ok", `${r.tracking} activated${r.destination ? ` → ${r.destination}` : ""}`);
      else if (r.kind === "already") push("warn", `${r.tracking} is already ${r.status.replaceAll("_", " ").toLowerCase()}`);
      else push("err", r.message);
      if (r.kind !== "new") refocus();
    });
  }, [shelf]);

  const n = (s: string) => parseFloat(s) || 0;
  const price = n(form.weight) && n(form.l) && n(form.w) && n(form.h)
    ? calcPricing({ weightLbs: n(form.weight), length: n(form.l), width: n(form.w), height: n(form.h) }) : null;
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!tracking) return;
    start(async () => {
      const r = await activateParcel({
        tracking, senderName: form.senderName, senderPhone: form.senderPhone,
        receiverName: form.receiverName, receiverPhone: form.receiverPhone, destination: form.destination,
        weightLbs: n(form.weight), length: n(form.l), width: n(form.w), height: n(form.h), shelf,
      });
      if (!r.ok) return setError(r.message);
      push("ok", `${tracking} activated · $${r.label.total.toFixed(2)}`);
      setTracking(null);
      setLabel(r.label);
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Activate parcel</h1>
        <p className="text-sm text-muted-foreground">Scan a barcode to begin. Press / to refocus the scanner.</p>
      </header>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={scanRef} autoFocus autoComplete="off" value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScan(value); } }}
            onBlur={() => { if (!tracking && !camera) refocus(); }}
            placeholder="Scan tracking number" className="h-14 pl-10 font-mono text-lg"
          />
        </div>
        <Input value={shelf} onChange={(e) => setShelf(e.target.value.toUpperCase())} placeholder="Shelf" className="h-14 w-24 font-mono" aria-label="Shelf location" />
        <Button type="button" variant="outline" className="h-14" onClick={() => setCamera((c) => !c)} aria-label="Toggle camera scanner">
          {camera ? <X className="size-5" /> : <Camera className="size-5" />}
        </Button>
      </div>

      {camera && <CameraScanner onCode={(c) => { setCamera(false); handleScan(c); }} />}

      <ul className="divide-y rounded-md border text-sm">
        {log.length === 0 && <li className="p-4 text-muted-foreground">Scanned parcels appear here.</li>}
        {log.map((l) => (
          <li key={l.id} className="flex items-center gap-2 p-3">
            <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${l.tone === "ok" ? "bg-emerald-100 text-emerald-800" : l.tone === "warn" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
              {l.tone === "ok" ? "Activated" : l.tone === "warn" ? "Skipped" : "Error"}
            </span>
            <span className="font-mono">{l.text}</span>
          </li>
        ))}
      </ul>

      <Dialog open={!!tracking} onOpenChange={(o) => { if (!o) { setTracking(null); refocus(); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" />New parcel <span className="font-mono">{tracking}</span></DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid grid-cols-2 gap-3">
            <Field label="Sender name" v={form.senderName} on={set("senderName")} autoFocus />
            <Field label="Sender phone" v={form.senderPhone} on={set("senderPhone")} type="tel" />
            <Field label="Receiver name" v={form.receiverName} on={set("receiverName")} />
            <Field label="Receiver phone" v={form.receiverPhone} on={set("receiverPhone")} type="tel" />
            <div className="col-span-2"><Field label="Destination city" v={form.destination} on={set("destination")} /></div>
            <Field label="Weight (lb)" v={form.weight} on={set("weight")} type="number" step="0.1" min="0" />
            <div className="grid grid-cols-3 gap-2">
              <Field label="L (in)" v={form.l} on={set("l")} type="number" min="0" />
              <Field label="W (in)" v={form.w} on={set("w")} type="number" min="0" />
              <Field label="H (in)" v={form.h} on={set("h")} type="number" min="0" />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-md bg-zinc-100 px-3 py-2 text-sm">
              {price ? (<>
                <span>Volumetric <b>{price.volumetric} lb</b> · Chargeable <b>{price.chargeable} lb</b></span>
                <span className="text-lg font-semibold">${price.total.toFixed(2)}</span>
              </>) : <span className="text-muted-foreground">Enter weight and dimensions to see the price.</span>}
            </div>
            {error && <p className="col-span-2 text-sm text-red-600" role="alert">{error}</p>}
            <Button type="submit" disabled={pending} className="col-span-2 h-11">{pending ? "Activating…" : "Activate and print label"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Off-screen label used by react-to-print */}
      <div className="fixed -left-[9999px] top-0" aria-hidden>{label && <ParcelLabel ref={labelRef} data={label} />}</div>
    </div>
  );
}

function Field({ label, v, on, ...p }: { label: string; v: string; on: React.ChangeEventHandler<HTMLInputElement> } & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input required value={v} onChange={on} {...p} />
    </div>
  );
}

function CameraScanner({ onCode }: { onCode: (c: string) => void }) {
  const cb = useRef(onCode);
  cb.current = onCode;
  useEffect(() => {
    let stop: (() => Promise<void>) | undefined;
    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const s = new Html5Qrcode("cam");
      await s.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 280, height: 160 } }, (t) => cb.current(t), () => {});
      stop = async () => { await s.stop(); s.clear(); };
    })().catch(() => {});
    return () => { cancelled = true; stop?.(); };
  }, []);
  return <div id="cam" className="overflow-hidden rounded-md border" />;
}
