// ============================================================
// Offline attendance queue (browser only).
// When the device has no connection, check-in / check-out events
// are stored in localStorage and pushed to the server later.
// The server de-duplicates on `eventId`, so a retry is always safe.
// ============================================================

export type QueuedEvent = {
  eventId: string;
  type: "check_in" | "check_out";
  deviceTime: string;
  photo: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  /** Rotating entrance code, when the office requires one. */
  gateCode?: string;
};

const STORAGE_KEY = "attendease.attendance.queue";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Collision-safe id; falls back to a random string when crypto.randomUUID is unavailable. */
export function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function readQueue(): QueuedEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedEvent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedEvent[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("attendease:queue-changed"));
}

export function enqueue(event: QueuedEvent): void {
  const queue = readQueue();
  if (queue.some((item) => item.eventId === event.eventId)) return;
  writeQueue([...queue, event]);
}

export function removeFromQueue(eventId: string): void {
  writeQueue(readQueue().filter((item) => item.eventId !== eventId));
}

export function clearQueue(): void {
  writeQueue([]);
}

export function queueCount(): number {
  return readQueue().length;
}
