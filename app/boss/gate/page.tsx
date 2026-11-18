import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { ArrowLeft, ShieldCheck, ShieldOff } from "lucide-react";
import GateScreen from "@/components/gate-screen";
import { getSettings } from "@/lib/queries";
import { gateSnapshot, GATE_STEP_SECONDS } from "@/lib/gate";
import { requireBoss } from "@/lib/session";
import { setGateRequirement } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Entrance gate — AttendEase" };

export default async function GatePage() {
  await requireBoss();
  const settings = await getSettings();

  const now = gateSnapshot();
  const code = now.code;
  const secondsLeft = now.secondsLeft;

  // The QR carries a normal link, so a phone's own camera app opens the site
  // with the code already filled in — no in-app scanner needed.
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`).replace(/\/$/, "");
  const scanUrl = `${base}/app/gate?code=${code}`;

  const qrSvg = await QRCode.toString(scanUrl, {
    type: "svg",
    margin: 1,
    width: 288,
    errorCorrectionLevel: "M",
  });

  const required = settings.require_gate_code === 1;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6">
      <Link
        href="/boss"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <h1 className="text-xl font-black text-slate-900">Entrance gate</h1>
      <p className="mt-1 text-sm text-slate-600">
        Leave this screen open on a tablet or laptop at the {settings.office_name} entrance. The code
        changes every {GATE_STEP_SECONDS} seconds, so a screenshot or a code shared from home is useless.
      </p>

      <GateScreen
        key={code}
        code={code}
        secondsLeft={secondsLeft}
        totalSeconds={GATE_STEP_SECONDS}
        qrSvg={qrSvg}
      />

      <div className="card mt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              {required ? (
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              ) : (
                <ShieldOff className="h-4 w-4 text-slate-400" />
              )}
              Gate code {required ? "required" : "optional"}
            </p>
            <p className="mt-1 max-w-xl text-xs text-slate-500">
              {required
                ? "Every check-in and check-out must include the current entrance code. Captures without it (or with an expired one) still get saved, but they are flagged for your review."
                : "The gate screen is live, but codes are not enforced yet. Turn this on to require presence at the entrance for a verified check-in."}
            </p>
          </div>

          <form action={setGateRequirement}>
            <input type="hidden" name="enabled" value={required ? "0" : "1"} />
            <button type="submit" className={`btn btn-sm ${required ? "btn-ghost" : "btn-primary"}`}>
              {required ? "Stop requiring the code" : "Require the gate code"}
            </button>
          </form>
        </div>

        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">
          How it works: the employee scans the QR with their phone camera (or types the 6 digits), then
          takes a selfie. The server checks the code against its own clock, so the device clock or a
          stale screenshot cannot be used. The previous code stays valid for one extra step (~30 s) to
          cover scanning + submitting.
        </p>
      </div>
    </main>
  );
}
