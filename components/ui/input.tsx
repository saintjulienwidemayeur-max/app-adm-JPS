import type { ComponentProps } from "react";

export function Input({ className = "", ...p }: ComponentProps<"input">) {
  return <input className={`h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 disabled:opacity-50 ${className}`} {...p} />;
}
