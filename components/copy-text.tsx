"use client";
import { useState } from "react";

// A text the staff can read, adjust and copy (to WhatsApp or an e-mail reply).
export function CopyText({ text, label = "Copy" }: { text: string; label?: string }) {
  const [v, setV] = useState(text), [ok, setOk] = useState(false);
  return (
    <div className="grid gap-1">
      <textarea value={v} onChange={(e) => setV(e.target.value)} rows={7} className="w-full rounded-md border border-zinc-300 bg-white p-2 text-sm" aria-label="Message for the customer" />
      <div className="flex items-center gap-2">
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(v); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* the text is selectable anyway */ } }} className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium hover:bg-zinc-100">{label}</button>
        {ok && <span className="text-xs font-medium text-green-700">Copied</span>}
      </div>
    </div>
  );
}
