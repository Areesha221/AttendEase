import Link from "next/link";
import { ArrowLeft, CalendarCheck, CheckCircle2, Clock, MapPin } from "lucide-react";
import SelfieCapture from "@/components/selfie-capture";
import StatusBadge from "@/components/status-badge";
import { getEmployeeByUserId, getEventsForDate, getMonthEvaluations, getSettings } from "@/lib/queries";
import { eventClock } from "@/lib/rules";
import { formatDateHuman, formatHours, formatTime12, monthLabel, toWorkDate, weekdayName } from "@/lib/time";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "My attendance — AttendEase" };

export default async function StaffAttendancePage() {
  const session = await requireStaff();
  const employee = await getEmployeeByUserId(session.userId);

  if (!employee) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <div className="card">
          <p className="font-semibold text-slate-900">No attendance profile is linked to this account.</p>
          <p className="mt-1 text-sm text-slate-600">
            Ask the administrator to link an employee profile before you can check in.
          </p>
        </div>
      </main>
    );
  }

  const settings = await getSettings();
  const workDate = toWorkDate();
  const events = (await getEventsForDate(employee.id, workDate)).filter(
    (event) => event.review_status !== "rejected",
  );
  const checkIn = events.find((event) => event.type === "check_in") ?? null;
  const checkOut = events.find((event) => event.type === "check_out") ?? null;

  const { days, summary } = await getMonthEvaluations(employee.id, workDate);
  const recent = days
    .filter((day) => day.workDate <= workDate)
    .slice(-10)
    .reverse();

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6">
      <Link
        href="/boss"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to staff dashboard
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">My attendance</h1>
          <p className="mt-1 text-sm text-slate-600">
            {employee.full_name} · {employee.employee_code} · {employee.department ?? "Unassigned"}
          </p>
        </div>
        <p className="text-xs font-semibold text-slate-500">
          {monthLabel(workDate)} · {settings.work_start} – {settings.work_end}
        </p>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-tight">
          <p className="stat-label">Attendance</p>
          <p className="stat-value">{summary.attendancePercentage}%</p>
          <p className="text-[11px] text-slate-500">
            {summary.presentDays} present of {summary.workingDays} working days
          </p>
        </div>
        <div className="card-tight">
          <p className="stat-label">On time / Late</p>
          <p className="stat-value">
            {summary.onTimeDays} / {summary.lateDays}
          </p>
          <p className="text-[11px] text-slate-500">late minutes: {summary.lateMinutesTotal}</p>
        </div>
        <div className="card-tight">
          <p className="stat-label">Absent / Leave</p>
          <p className="stat-value">
            {summary.absentDays} / {summary.leaveDays}
          </p>
          <p className="text-[11px] text-slate-500">
            weekends: {summary.weekendDays} · holidays: {summary.holidayDays}
          </p>
        </div>
        <div className="card-tight">
          <p className="stat-label">Hours</p>
          <p className="stat-value">{formatHours(summary.workedHours)}</p>
          <p className="text-[11px] text-slate-500">overtime: {formatHours(summary.overtimeHours)}</p>
        </div>
      </section>

      <section className="mt-5">
        {checkIn && checkOut ? (
          <div className="card">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Your day is complete.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Checked in at {formatTime12(eventClock(checkIn))} and checked out at{" "}
              {formatTime12(eventClock(checkOut))}.
            </p>
          </div>
        ) : checkIn ? (
          <div>
            <div className="card mb-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-5 w-5" /> Checked in today at {formatTime12(eventClock(checkIn))}.
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Take a selfie and submit your location to check out when you finish work.
              </p>
            </div>
            <SelfieCapture
              type="check_out"
              employeeName={employee.full_name}
              employeeCode={employee.employee_code}
              successHref="/boss/me/success"
              office={{
                name: settings.office_name,
                lat: settings.office_lat,
                lng: settings.office_lng,
                radiusM: settings.radius_m,
              }}
              gateRequired={settings.require_gate_code === 1}
            />
          </div>
        ) : (
          <div>
            <div className="card mb-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <MapPin className="h-5 w-5 text-blue-800" /> {settings.office_name}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Check in with a live selfie and your location. Server time is used, so the device clock cannot be
                changed.
              </p>
            </div>
            <SelfieCapture
              type="check_in"
              employeeName={employee.full_name}
              employeeCode={employee.employee_code}
              successHref="/boss/me/success"
              office={{
                name: settings.office_name,
                lat: settings.office_lat,
                lng: settings.office_lng,
                radiusM: settings.radius_m,
              }}
              gateRequired={settings.require_gate_code === 1}
            />
          </div>
        )}
      </section>

      <section className="mt-6 card">
        <p className="section-title flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" /> Last 10 days
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] tracking-wide text-slate-500 uppercase">
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 pr-3 font-semibold">Check-in</th>
                <th className="py-2 pr-3 font-semibold">Check-out</th>
                <th className="py-2 font-semibold">Hours</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((day) => (
                <tr key={day.workDate} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className="font-medium text-slate-800">{formatDateHuman(day.workDate)}</span>
                    <span className="ml-2 text-[11px] text-slate-400">{weekdayName(day.workDate).slice(0, 3)}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusBadge status={day.status} />
                  </td>
                  <td className="py-2.5 pr-3 text-slate-700">{formatTime12(eventClock(day.checkIn))}</td>
                  <td className="py-2.5 pr-3 text-slate-700">{formatTime12(eventClock(day.checkOut))}</td>
                  <td className="py-2.5 text-slate-700">{formatHours(day.hours)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm text-slate-500">
                    No attendance recorded yet this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
          <CalendarCheck className="h-3.5 w-3.5" /> Staff attendance stays inside your own account and is not mixed
          into the employee attendance desk.
        </p>
      </section>
    </main>
  );
}
