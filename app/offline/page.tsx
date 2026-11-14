import Link from "next/link";
import { CloudOff, RefreshCw } from "lucide-react";

export const metadata = {
  title: "Offline — AttendEase",
  description: "You are offline. Reconnect to continue.",
};

/**
 * Fallback page served by the service worker when the user opens the app
 * while offline and the requested page is not in the cache yet.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200 text-slate-600">
        <CloudOff className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-xl font-black text-slate-900">You are offline</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        This page isn&apos;t saved on your device yet. Reconnect to load it. Any attendance you already captured
        is stored safely on this device and will sync automatically once you are back online.
      </p>
      <Link href="/" className="btn btn-primary mt-6">
        <RefreshCw className="h-4 w-4" /> Try again
      </Link>
    </main>
  );
}
