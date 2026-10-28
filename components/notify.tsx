"use client";
// The "Notify" buttons: a spinner while the e-mail and the WhatsApp message are being sent, and, when one of them did not go, a button to send only that one again.
import { Suspense, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function Btn({ label, className, title, disabled }: { label: ReactNode; className?: string; title?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} aria-busy={pending} title={title} className={`${className ?? ""} ${pending ? "cursor-wait opacity-80" : ""}`}>
      {pending ? <span className="inline-flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" aria-hidden /> Sending…</span> : label}
    </button>
  );
}
export function NotifyForm({ action, label = "Notify", className, title, disabled }: { action: () => void | Promise<void>; label?: ReactNode; className?: string; title?: string; disabled?: boolean }) {
  return <form action={action}><Btn label={label} className={className} title={title} disabled={disabled} /></form>;
}

type Retry = (kind: string, channel: string, ids: string, ret: string) => Promise<void>;
function Inner({ retry }: { retry: Retry }) {
  const q = useSearchParams(), path = usePathname();
  const nm = q.get("nm") ?? "", nw = q.get("nw") ?? "", kind = q.get("nkind") ?? "";
  if ((!nm && !nw) || !kind) return null;
  const count = (s: string) => s.split(",").filter(Boolean).length;
  const cls = "inline-flex h-9 items-center rounded-md border border-amber-600 bg-white px-3 text-sm font-medium text-amber-900";
  return (
    <div role="alert" className="no-print border-b border-amber-300 bg-amber-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2 text-sm text-amber-900">
        <span className="font-semibold">Not sent:</span>
        {nm && <span>e-mail ({count(nm)})</span>}{nw && <span>WhatsApp ({count(nw)})</span>}
        <span className="ml-auto flex flex-wrap gap-2">
          {nm && <form action={retry.bind(null, kind, "email", nm, path)}><Btn label="Send the e-mail again" className={cls} /></form>}
          {nw && <form action={retry.bind(null, kind, "wa", nw, path)}><Btn label="Send the WhatsApp again" className={cls} /></form>}
        </span>
      </div>
    </div>
  );
}
export function NotifyResult({ retry }: { retry: Retry }) { return <Suspense fallback={null}><Inner retry={retry} /></Suspense>; }
