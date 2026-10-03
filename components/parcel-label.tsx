"use client";

import { forwardRef, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import type { LabelData } from "@/app/warehouse/intake/actions";

// 4x6 in thermal label. Print with react-to-print: useReactToPrint({ contentRef }).
export const ParcelLabel = forwardRef<HTMLDivElement, { data: LabelData }>(({ data }, ref) => {
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svg.current)
      JsBarcode(svg.current, data.tracking, { format: "CODE128", height: 70, displayValue: true, fontSize: 16, margin: 0 });
  }, [data.tracking]);

  return (
    <div ref={ref} className="label-4x6 bg-white text-black" style={{ width: "4in", height: "6in", padding: "0.2in", fontFamily: "Arial, sans-serif" }}>
      <div className="flex items-baseline justify-between border-b-2 border-black pb-1">
        <div className="text-lg font-black leading-none">JP&apos;s Logistics &amp; More</div>
        <div className="text-xs">{data.date}</div>
      </div>
      <div className="mt-2 text-xs font-semibold">TO</div>
      <div className="text-2xl font-black leading-tight">{data.receiverName}</div>
      <div className="text-sm">{data.receiverPhone}</div>
      <div className="my-2 border-2 border-black p-2 text-center text-4xl font-black uppercase leading-none">{data.destination}</div>
      <div className="grid grid-cols-2 gap-1 text-sm">
        <div>Weight: <b>{data.weightLbs} lb</b></div>
        <div>Dims: <b>{data.dims}</b></div>
        <div>Volumetric: <b>{data.volumetric} lb</b></div>
        <div>Chargeable: <b>{data.chargeable} lb</b></div>
        {data.shelf && <div>Shelf: <b>{data.shelf}</b></div>}
      </div>
      <div className="mt-2 border-t border-black pt-1 text-xs">
        <b>FROM:</b> {data.senderName} · {data.senderPhone}
      </div>
      <div className="mt-3 flex justify-center"><svg ref={svg} /></div>
      <style>{`@page { size: 4in 6in; margin: 0 } @media print { body { margin: 0 } }`}</style>
    </div>
  );
});
ParcelLabel.displayName = "ParcelLabel";
