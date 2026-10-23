import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1>Page not found</h1>
      <p className="mt-2 text-sm text-zinc-600">This page or record does not exist (it may have been deleted, or the number is wrong).</p>
      <Link href="/" className="mt-5 inline-flex h-10 items-center rounded-md bg-brand px-5 text-sm font-medium text-white">Back to the main menu</Link>
    </main>
  );
}
