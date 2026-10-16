"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";

// Registers the service worker (production only: in development it would cache old files).
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
// "Install app": shown only when the browser offers it (Chrome, Edge, Android) and the app is not installed yet.
export function InstallButton() {
  const [ev, setEv] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEv(e as InstallEvent); };
    const done = () => setEv(null);
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", on); window.removeEventListener("appinstalled", done); };
  }, []);
  if (!ev) return null;
  return (
    <button type="button" onClick={async () => { await ev.prompt(); await ev.userChoice.catch(() => {}); setEv(null); }}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-white/85 hover:bg-white/10 hover:text-white"><Download size={16} aria-hidden /> Install the app</button>
  );
}
