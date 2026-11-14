"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/** Selfie thumbnail that opens a larger review overlay when clicked. */
export default function PhotoReview({
  src,
  name,
  size = 44,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!src) {
    return (
      <span
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-semibold text-slate-400"
      >
        No photo
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 overflow-hidden rounded-lg ring-2 ring-white transition hover:ring-indigo-300"
        style={{ width: size, height: size }}
        title="Review selfie"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- photos are inline data URIs */}
        <img src={src} alt={`${name} selfie`} className="h-full w-full object-cover" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div className="relative max-w-sm" onClick={(event) => event.stopPropagation()} role="presentation">
            {/* eslint-disable-next-line @next/next/no-img-element -- photos are inline data URIs */}
            <img src={src} alt={`${name} selfie`} className="max-h-[70vh] rounded-2xl bg-white object-contain" />
            <p className="mt-2 text-center text-sm font-semibold text-white">{name}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
