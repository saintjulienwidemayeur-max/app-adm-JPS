"use client";
import { useEffect, useState } from "react";
import { Camera, X } from "lucide-react";

// Fills the input with the given id from the phone/laptop camera. submit: also submit its form.
export function CameraScan({ target, submit = false }: { target: string; submit?: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    let stop = () => {};
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      const s = new Html5Qrcode("cam-reader");
      try {
        await s.start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, (txt) => {
          const el = document.getElementById(target) as HTMLInputElement | null;
          if (el) {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, txt);
            el.dispatchEvent(new Event("input", { bubbles: true }));
            if (submit) el.form?.requestSubmit();
          }
          setOn(false);
        }, () => {});
        stop = () => { s.stop().then(() => s.clear()).catch(() => {}); };
      } catch { setOn(false); }
    })();
    return () => stop();
  }, [on, target, submit]);
  return (
    <>
      <button type="button" onClick={() => setOn((v) => !v)} aria-label={on ? "Close camera" : "Scan with camera"} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white hover:bg-zinc-100">
        {on ? <X size={16} /> : <Camera size={16} />}
      </button>
      {on && <div id="cam-reader" className="col-span-full w-full max-w-sm" />}
    </>
  );
}
