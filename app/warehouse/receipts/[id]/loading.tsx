// Shown at once while a receipt page is being prepared, so a slow answer never looks like an empty page.
export default function Loading() {
  return <main className="mx-auto max-w-5xl px-4 py-10" role="status" aria-live="polite"><div className="flex items-center gap-3 text-zinc-600"><span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-brand" />Loading the receipt…</div></main>;
}
