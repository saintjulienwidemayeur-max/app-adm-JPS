import type { ComponentProps } from "react";

// Full width unless the caller gives a width (two width classes on one element: the stylesheet order decides, not the class order).
export function Input({ className = "", ...p }: ComponentProps<"input">) {
  const own = /(^|\s)(!?)(sm:|md:|lg:)?(w|max-w)-/.test(className);
  return <input className={`h-9 ${own ? "" : "w-full"} rounded-md border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 disabled:opacity-50 ${className}`} {...p} />;
}
