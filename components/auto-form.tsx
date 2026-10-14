"use client";
import { useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

// A form that applies itself: after a short pause in typing (or on any change) the page reloads with the form's values in the URL.
// Empty values are left out. The server page reads the URL, so the result is shareable and survives a refresh.
export function AutoForm({ children, className = "" }: { children: ReactNode; className?: string }) {
  const router = useRouter(), path = usePathname(), ref = useRef<HTMLFormElement>(null), timer = useRef<number | undefined>(undefined);
  const push = () => {
    if (!ref.current) return;
    const p = new URLSearchParams();
    new FormData(ref.current).forEach((v, k) => { const s = String(v).trim(); if (s) p.append(k, s); });
    router.replace(p.size ? `${path}?${p}` : path, { scroll: false });
  };
  return (
    <form ref={ref} className={className} autoComplete="off"
      onSubmit={(e) => { e.preventDefault(); window.clearTimeout(timer.current); push(); }}
      onInput={() => { window.clearTimeout(timer.current); timer.current = window.setTimeout(push, 400); }}>
      {children}
    </form>
  );
}
