import Link from "next/link";
import { AlertTriangle, Camera, ExternalLink, MapPin, ScanFace } from "lucide-react";
import AttendanceReview from "@/components/attendance-review";
import PhotoReview from "@/components/photo-review";
import { GPS_ACCURACY_LIMIT_M, TONE_CLASSES } from "@/lib/rules";
import { listDayAttendance, listReviewQueue } from "@/lib/queries";
import { formatDateHuman, formatStamp12, toWorkDate } from "@/lib/time";
import { requireBoss } from "@/lib/session";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "review", label: "Awaiting review" },
  { key: "flagged", label: "Flagged" },
  { key: "verified", label: "Verified" },
  { key: "pending", label: "Pending sync" },
] as const;

export default async function AttendanceMonitorPage(props: PageProps<"/boss/attendance">) {
  await requireBoss();

  const params = await props.searchParams;
  const today = toWorkDate();
  const date = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const filter = typeof params.filter === "string" ? params.filter : "all";
  const allDates = filter === "review" && params.scope === "all";

  const events = allDates ? await listReviewQueue(200) : await listDayAttendance(date);
  const filtered = events.filter((event) => {
    if (filter === "review") return event.review_status === "pending";
    if (filter === "flagged") return event.verification === "flagged" || event.location_status === "outside";
    if (filter === "verified") return event.verification === "verified";
    if (filter === "pending") return event.sync_status === "pending";
    return true;
  });

  const checkIns = events.filter((event) => event.type === "check_in").length;
  const checkOuts = events.filter((event) => event.type === "check_out").length;
  const flagged = events.filter((event) => event.verification === "flagged" || event.location_status === "outside").length;
  const pendingSync = events.filter((event) => event.sync_status === "pending").length;
  const awaitingReview = events.filter((event) => event.review_status === "pending").length;

  const summary = [
    { label: "Events", value: events.length, tone: "text-slate-900" },
    { label: "Check-ins", value: checkIns, tone: "text-emerald-600" },
    { label: "Check-outs", value: checkOuts, tone: "text-indigo-600" },
    { label: "Flagged location", value: flagged, tone: "text-rose-600" },
    { label: "Awaiting review", value: awaitingReview, tone: "text-amber-600" },
    { label: "Pending sync", value: pendingSync, tone: "text-amber-600" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Attendance monitor</h1>
          <p className="mt-1 text-sm text-slate-600">
            Selfie + GPS verification for{" "}
            {allDates ? "all dates (pending review queue)" : formatDateHuman(date)} • server time (Asia/Karachi)
          </p>
        </div>
        <form action="/boss/attendance" className="flex items-end gap-2">
          <div>
            <label className="label" htmlFor="date">
              Work date
            </label>
            <input id="date" type="date" name="date" defaultValue={date} max={today} className="input" />
          </div>
          <input type="hidden" name="filter" value={filter} />
          <input type="hidden" name="scope" value="day" />
          <button type="submit" className="btn btn-primary">
            Go
          </button>
        </form>
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summary.map((item) => (
          <div key={item.label} className="card-tight">
            <p className="stat-label">{item.label}</p>
            <p className={`mt-1 text-2xl font-bold ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={`/boss/attendance?date=${date}&filter=${item.key}`}
            className={`badge ${filter === item.key ? "bg-indigo-600 text-white ring-indigo-600" : "bg-slate-100 text-slate-600 ring-slate-200"}`}
          >
            {item.label}
          </Link>
        ))}
        {filter === "review" && (
          <Link
            href={
              allDates
                ? `/boss/attendance?date=${date}&filter=review`
                : `/boss/attendance?filter=review&scope=all`
            }
            className="badge bg-indigo-50 text-indigo-700 ring-indigo-200"
          >
            {allDates ? `Show only ${formatDateHuman(date)}` : "Show all dates"}
          </Link>
        )}
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((event) => {
          const outside = event.location_status === "outside";
          const needsReview =
            event.review_status !== "not_required" ||
            event.verification === "flagged" ||
            outside ||
            event.sync_status === "pending";
          const reviewed = event.review_status === "approved" || event.review_status === "rejected";
          const reviewTone =
            event.review_status === "approved"
              ? TONE_CLASSES.green
              : event.review_status === "rejected"
                ? TONE_CLASSES.red
                : TONE_CLASSES.yellow;
          const verificationTone =
            event.verification === "flagged" ? TONE_CLASSES.red : event.verification === "pending" ? TONE_CLASSES.yellow : TONE_CLASSES.green;
          return (
            <article key={event.id} className="card-tight flex gap-3">
              <PhotoReview src={event.photo} name={event.employee_name} size={64} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{event.employee_name}</p>
                <p className="text-[11px] text-slate-500">
                  {event.employee_code} • {event.department ?? "Unassigned"}
                </p>
                <p className="mt-1 text-xs text-slate-700">
                  {allDates && <span className="font-semibold">{formatDateHuman(event.work_date)} • </span>}
                  {event.type === "check_in" ? "Checked in" : "Checked out"} at {formatStamp12(event.server_time)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className={`badge ${verificationTone}`}>
                    {outside ? <MapPin className="h-3 w-3" /> : <Camera className="h-3 w-3" />}
                    {event.verification}
                  </span>
                  {event.sync_status === "pending" && (
                    <span className={`badge ${TONE_CLASSES.yellow}`}>pending sync</span>
                  )}
                  {needsReview && (
                    <span className={`badge ${reviewTone}`}>
                      {event.review_status === "approved"
                        ? "review: approved"
                        : event.review_status === "rejected"
                          ? "review: rejected"
                          : "awaiting review"}
                    </span>
                  )}
                  <span className="badge bg-slate-100 text-slate-600 ring-slate-200">
                    {event.distance_m !== null ? `${event.distance_m} m` : "no GPS"}
                  </span>
                  {event.accuracy_m !== null && (
                    <span
                      className={`badge ${
                        event.accuracy_m > GPS_ACCURACY_LIMIT_M
                          ? TONE_CLASSES.yellow
                          : "bg-slate-100 text-slate-600 ring-slate-200"
                      }`}
                    >
                      ±{Math.round(event.accuracy_m)} m GPS
                    </span>
                  )}
                </div>
                {event.reason && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-rose-600">
                    <AlertTriangle className="h-3 w-3" /> {event.reason}
                  </p>
                )}
                {event.latitude !== null && event.longitude !== null && (
                  <a
                    href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline"
                  >
                    <MapPin className="h-3 w-3" />
                    {event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {needsReview && reviewed && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="text-[11px] text-slate-500">
                      {event.review_status === "approved" ? "Approved" : "Rejected"} by{" "}
                      {event.reviewed_by ?? "boss"}
                      {event.reviewed_at ? ` • ${formatStamp12(event.reviewed_at)}` : ""}
                      {event.review_note ? ` — ${event.review_note}` : ""}
                    </p>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px] font-semibold text-indigo-600">
                        Change decision
                      </summary>
                      <AttendanceReview eventId={event.id} />
                    </details>
                  </div>
                )}
                {needsReview && !reviewed && <AttendanceReview eventId={event.id} />}
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="card-tight col-span-full flex items-center gap-2 text-xs text-slate-500">
            <ScanFace className="h-4 w-4" /> No attendance events for this filter.
          </div>
        )}
      </section>

      <p className="mt-4 text-[11px] text-slate-500">
        Tip: click any selfie to review it full size, and tap the coordinates to open the exact capture point in
        Google Maps. Records marked “flagged” were captured outside the office radius, synced late from the offline
        queue, or came with a GPS accuracy worse than ±<strong>{GPS_ACCURACY_LIMIT_M} m</strong>. Use{" "}
        <strong>Approve</strong> if the event is valid, or <strong>Reject</strong> if it should not count. Every
        decision is written to the audit log and the employee is notified.
      </p>
    </main>
  );
}
