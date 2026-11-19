"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function subscribeNoop() {
  return () => {};
}

/** True on iOS/iPadOS, where `beforeinstallprompt` never fires. */
function useIsIOS(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window),
    () => false,
  );
}

/** True when the app is already running as an installed PWA. */
function useIsStandalone(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true,
    () => false,
  );
}

/**
 * Registers the service worker (production builds only, so `next dev` never
 * serves a stale cached chunk) and shows an "install app" prompt.
 *
 * Chrome/Edge fire `beforeinstallprompt`; iOS Safari does not, so we show the
 * manual "Add to Home Screen" instructions there instead.
 */
export default function PwaManager() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const isIOS = useIsIOS();
  const isStandalone = useIsStandalone();

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const visible = !dismissed && !isStandalone && (Boolean(deferred) || isIOS);
  if (!visible) return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setDismissed(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-blue-200 bg-white p-3.5 shadow-lg">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-900 text-sm font-black text-white">
          AE
        </span>
        <div className="flex-1 text-xs">
          <p className="font-bold text-slate-900">Install AttendEase</p>
          <p className="text-slate-500">
            {isIOS
              ? "Tap the Share icon, then \u201cAdd to Home Screen\u201d."
              : "Add it to your home screen for a full-screen, app-like experience."}
          </p>
        </div>
        {!isIOS && deferred && (
          <button type="button" onClick={install} className="btn btn-primary btn-sm">
            <Download className="h-3.5 w-3.5" /> Install
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss install prompt"
          className="btn btn-ghost btn-sm"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
