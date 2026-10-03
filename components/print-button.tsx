"use client";
export function PrintButton({ label = "Print" }: { label?: string }) {
  return <button onClick={() => window.print()} className="no-print h-9 rounded-md bg-brand px-4 text-sm font-medium text-white">{label}</button>;
}
