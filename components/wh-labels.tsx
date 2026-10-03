"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { PrintButton } from "./print-button";

export type LabelData = { code: string; ship: string; route?: string; rows: [string, string][] };

function Label({ d }: { d: LabelData }) {
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(d.code, { margin: 0, width: 220 }).then(setSrc); }, [d.code]);
  return (
    <div className="wh-label bg-white p-3 text-black" style={{ width: "4in", height: "3in", fontFamily: "Arial, sans-serif" }}>
      <div className="flex justify-between text-lg font-black"><span>{d.ship}</span><span>{d.route}</span></div>
      <div className="mt-1 text-center text-xl font-black">{d.code}</div>
      <div className="mt-1 flex justify-center">{src && /* eslint-disable-next-line @next/next/no-img-element */ <img src={src} alt="" width={96} height={96} />}</div>
      <div className="mt-1 grid grid-cols-2 gap-x-2 text-xs">{d.rows.map(([k, v]) => <div key={k}>{k} <b>{v}</b></div>)}</div>
    </div>
  );
}

export function Labels({ labels }: { labels: LabelData[] }) {
  return (
    <>
      <div className="no-print mb-4 flex items-center gap-3"><PrintButton label={`Print ${labels.length} labels`} /><span className="text-sm text-zinc-600">Set paper size to 4×3 in in the print dialog.</span></div>
      <div className="wh-labels flex flex-col gap-4">{labels.map((d) => <Label key={d.code} d={d} />)}</div>
      <style>{`@page { size: 4in 3in; margin: 0 }`}</style>
    </>
  );
}
