"use client";
import { useEffect, useRef, useState } from "react";

// The input a barcode scanner types into. A light shows if the scanner can type here: GREEN while the field has the cursor (the scanner is
// active), RED when it has not (a scan would go nowhere: click the field). A scanner types very fast, so when a fast burst of characters
// stops, the form is sent by itself: nobody presses "Add". Typing by hand (slow) is never sent by itself; Enter still sends.
export function ScanField({ id = "tracking", name = "tracking", placeholder = "Scan here", required = true, autoSubmit = true }: { id?: string; name?: string; placeholder?: string; required?: boolean; autoSubmit?: boolean }) {
  const ref = useRef<HTMLInputElement>(null), times = useRef<number[]>([]), timer = useRef<number | undefined>(undefined);
  const [focus, setFocus] = useState(false), [seen, setSeen] = useState(false);
  useEffect(() => { const el = ref.current; if (el && document.activeElement === el) setFocus(true); }, []);
  const send = () => {
    const el = ref.current, t = times.current;
    if (!el || !autoSubmit || el.value.trim().length < 6) return;
    const burst = t.length >= 6 && (t[t.length - 1] - t[0]) / (t.length - 1) < 45; // average gap under 45 ms: a scanner, not a hand
    if (burst || t.length === 1) { setSeen(true); times.current = []; el.form?.requestSubmit(); } // one single event with the whole code = pasted or camera
  };
  return (
    <span className="flex flex-1 items-center gap-2">
      <input ref={ref} id={id} name={name} placeholder={placeholder} autoFocus autoComplete="off" required={required} spellCheck={false}
        className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400"
        onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); times.current = []; }}
        onInput={() => { times.current.push(Date.now()); window.clearTimeout(timer.current); timer.current = window.setTimeout(send, 160); }} />
      <span role="status" aria-live="polite" className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${focus ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${focus ? "bg-green-600" : "bg-red-600"}`} />{focus ? (seen ? "Scanner active" : "Ready to scan") : "Scanner off: click the field"}
      </span>
    </span>
  );
}
