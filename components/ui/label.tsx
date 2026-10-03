import type { ComponentProps } from "react";

export function Label({ className = "", ...p }: ComponentProps<"label">) {
  return <label className={`block text-sm font-medium text-zinc-700 ${className}`} {...p} />;
}
