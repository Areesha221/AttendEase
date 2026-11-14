"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Loader2, RefreshCw, Wifi } from "lucide-react";
import { readQueue, removeFromQueue } from "@/lib/offline-queue";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function subscribeQueue(callback: () => void) {
  window.addEventListener("attendease:queue-changed", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("attendease:queue-changed", callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * Shows connection state and flushes any attendance events that were
 * captured while offline. Syncs when the device comes back online and
 * when the user taps "Sync now".
 */
export default function OfflineBanner() {
  const router = useRouter();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const count = useSyncExternalStore(
    subscribeQueue,
    () => readQueue().length,
    () => 0,
  );
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sync = useCallback(
    async (manual = false) => {
      const queue = readQueue();
      if (queue.length === 0) {
        if (manual) setMessage("Nothing to sync.");
        return;
      }
      setSyncing(true);
      setMessage(null);
      try {
        const response = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: queue }),
        });
        if (!response.ok) throw new Error("sync failed");
        const data = (await response.json()) as {
          results?: { eventId: string | null; status: string; message?: string }[];
        };
        const handled = new Set((data.results ?? []).map((row) => row.eventId));
        for (const event of queue) {
          if (event.eventId && handled.has(event.eventId)) removeFromQueue(event.eventId);
        }
        const accepted = (data.results ?? []).filter((row) => row.status === "accepted").length;
        const rejected = (data.results ?? []).filter((row) => row.status === "rejected");
        if (rejected.length > 0) {
          setMessage(`${accepted} synced, ${rejected.length} not accepted: ${rejected[0].message ?? ""}`);
        } else if (accepted > 0) {
          setMessage(`${accepted} offline event(s) synced.`);
        }
        router.refresh();
      } catch {
        setMessage("Still offline — events stay queued.");
      } finally {
        setSyncing(false);
      }
    },
    [router],
  );

  // Flush the queue automatically the moment connectivity returns.
  useEffect(() => {
    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [sync]);

  if (online && count === 0 && !message) return null;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-3">
      <div
        className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 text-xs font-medium ${
          online ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-300 bg-slate-100 text-slate-700"
        }`}
      >
        {online ? <Wifi className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
        <span className="flex-1">
          {online
            ? count > 0
              ? `${count} attendance event(s) captured offline are waiting to sync.`
              : (message ?? "Connected")
            : "You are offline. Attendance you capture now is saved on this device and synced later."}
        </span>
        {online && count > 0 && (
          <button type="button" onClick={() => void sync(true)} disabled={syncing} className="btn btn-sm btn-ghost">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync now
          </button>
        )}
        {message && count === 0 && <span className="text-[11px] opacity-80">{message}</span>}
      </div>
    </div>
  );
}
