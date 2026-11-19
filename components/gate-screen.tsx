"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TimerReset } from "lucide-react";

type Props = {
  code: string;
  secondsLeft: number;
  totalSeconds: number;
  qrSvg: string;
};

/**
 * Entrance kiosk: shows the rotating QR + 6-digit code. The page is
 * re-rendered by the server every rotation, so nothing is trusted to the
 * browser clock — it only drives the countdown display.
 */
export default function GateScreen({ code, secondsLeft, totalSeconds, qrSvg }: Props) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(secondsLeft);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    // Safety net if a tab was in the background: re-render from the server.
    const sync = window.setInterval(() => router.refresh(), 20000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(sync);
    };
  }, [router]);

  useEffect(() => {
    if (remaining > 0) return;
    const timer = window.setTimeout(() => router.refresh(), 250);
    return () => window.clearTimeout(timer);
  }, [remaining, router]);

  const progress = Math.round((remaining / totalSeconds) * 100);

  return (
    <div className="card mt-5 text-center">
      <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Scan to clock in or out</p>

      <div
        className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3 ring-1 ring-slate-200"
        // The SVG is generated on the server from our own URL — never user input.
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />

      <p className="mt-4 text-4xl font-black tracking-[0.3em] text-slate-900">{code}</p>
      <p className="mt-1 text-xs text-slate-500">Or type this code in the attendance form</p>

      <div className="mx-auto mt-4 max-w-xs">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-700 transition-[width] duration-1000" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <TimerReset className="h-3.5 w-3.5" /> New code in {remaining}s
        </p>
      </div>
    </div>
  );
}
