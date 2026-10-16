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
      const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode");
      // QR codes and the barcodes of parcel labels (Code 128 / 39 / 93, ITF, EAN, PDF417, Data Matrix).
      const s = new Html5Qrcode("cam-reader", { verbose: false, formatsToSupport: [F.QR_CODE, F.CODE_128, F.CODE_39, F.CODE_93, F.ITF, F.EAN_13, F.EAN_8, F.UPC_A, F.PDF_417, F.DATA_MATRIX], useBarCodeDetectorIfSupported: true });
      try {
        await s.start({ facingMode: "environment" }, { fps: 10, qrbox: (w: number, h: number) => ({ width: Math.floor(Math.min(w, 420) * 0.9), height: Math.floor(Math.min(h, 420) * 0.5) }) }, (txt) => {
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
