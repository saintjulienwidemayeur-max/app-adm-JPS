"use client";
import Link from "next/link";

// Shown when a page fails: nothing is lost (what was saved is in the database); try again or go back to the menu.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1>Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-600">The page could not be shown. Nothing you saved was lost. Try again; if it keeps happening, tell the administrator what you were doing.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => reset()} className="inline-flex h-10 items-center rounded-md bg-brand px-5 text-sm font-medium text-white">Try again</button>
        <Link href="/" className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium">Main menu</Link>
      </div>
    </main>
  );
}
