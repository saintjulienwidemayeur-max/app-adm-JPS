"use client";
import Link from "next/link";

// A file bigger than the server accepts (10 MB for everything sent at once) ends here instead of a bare "Application error".
export default function ImportError() {
  return (
    <div role="alert" className="mt-6 grid max-w-xl gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">The files could not be sent.</p>
      <p>The files are probably too big: the server takes 10 MB at most in one go (the customers file 8 MB; the 5 cargo files together 10 MB). Nothing was imported. Cut the file into smaller parts and try again.</p>
      <Link href="/settings/import" className="font-medium underline">Back to the import page</Link>
    </div>
  );
}
