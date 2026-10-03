"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";

export const Dialog = D.Root;

export function DialogContent({ className = "", children, ...p }: ComponentProps<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-black/50" />
      <D.Content
        aria-describedby={undefined}
        className={`fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white p-5 shadow-xl ${className}`}
        {...p}
      >
        {children}
        <D.Close className="absolute right-3 top-3 rounded p-1 text-zinc-500 hover:bg-zinc-100" aria-label="Close"><X className="size-4" /></D.Close>
      </D.Content>
    </D.Portal>
  );
}

export const DialogHeader = ({ className = "", ...p }: ComponentProps<"div">) => <div className={`mb-4 ${className}`} {...p} />;
export const DialogTitle = ({ className = "", ...p }: ComponentProps<typeof D.Title>) => <D.Title className={`text-base font-semibold ${className}`} {...p} />;
