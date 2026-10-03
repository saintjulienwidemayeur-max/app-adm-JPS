import type { ComponentProps } from "react";

const base = "inline-flex items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none";
const variants = {
  default: "bg-brand text-white hover:opacity-90",
  outline: "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100",
};

export function Button({ variant = "default", className = "", ...p }: ComponentProps<"button"> & { variant?: keyof typeof variants }) {
  return <button className={`${base} ${variants[variant]} h-9 ${className}`} {...p} />;
}
