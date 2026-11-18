import Link from "next/link";
import { CheckCircle2, CloudOff, Home, LogIn, LogOut, MapPin, ShieldCheck } from "lucide-react";
import { requireEmployee } from "@/lib/session";
import { formatStamp12 } from "@/lib/time";

export default async function SuccessPage(props: PageProps<"/app/success">) {
  await requireEmployee();
  const params = await props.searchParams;

  const type = params.type === "check_out" ? "check_out" : "check_in";
  const offline = params.offline === "1";
  const time = typeof params.time === "string" ? params.time : "";
  const status = typeof params.status === "string" ? params.status : "unavailable";
  const distance = typeof params.distance === "string" && params.distance ? params.distance : null;
  const flagged = !offline && (params.verification === "flagged" || params.verification === "pending");

  const isCheckIn = type === "check_in";
  const title = isCheckIn ? "Check-in recorded" : "Check-out recorded";

  const locationLabel =
    status === "inside" ? "Inside office radius" : status === "outside" ? "Outside office radius" : "Location unavailable";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-12">
      <div className="card text-center">
        <span
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
            offline ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {offline ? <CloudOff className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
        </span>

        <h1 className="mt-4 text-xl font-black text-slate-900">{offline ? "Saved offline" : title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {offline
            ? "You were offline, so this record is stored safely on this device. It will sync automatically when you reconnect."
            : isCheckIn
              ? "Your selfie and location were submitted. Have a great day."
              : "Thanks — your day is closed."}
        </p>

        <dl className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
            <dt className="flex items-center gap-1.5 text-slate-500">
              <ShieldCheck className="h-4 w-4" /> Server time
            </dt>
            <dd className="font-semibold text-slate-900">{offline ? "Pending sync" : formatStamp12(time)}</dd>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
            <dt className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="h-4 w-4" /> Location
            </dt>
            <dd className="font-semibold text-slate-900">
              {locationLabel}
              {distance ? ` · ${distance} m` : ""}
            </dd>
          </div>
        </dl>

        {flagged && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-left text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            This event was flagged for administrator review because the GPS reading was not strong enough to confirm
            the office radius. It is recorded, but it only counts as attendance after your boss approves it.
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/app" className="btn btn-primary">
            <Home className="h-4 w-4" /> Back to dashboard
          </Link>
          {isCheckIn ? (
            <Link href="/app/check-out" className="btn btn-ghost">
              <LogOut className="h-4 w-4" /> Go to check-out
            </Link>
          ) : (
            <Link href="/app/attendance" className="btn btn-ghost">
              <LogIn className="h-4 w-4" /> View attendance
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
