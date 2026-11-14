import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, TrendingUp } from "lucide-react";
import StatusBadge from "@/components/status-badge";
import { getEmployeeByUserId, getMonthEvaluations } from "@/lib/queries";
import { eventClock } from "@/lib/rules";
import { formatDateHuman, formatHours, formatTime12, monthLabel, toWorkDate, weekdayName } from "@/lib/time";
import { requireEmployee } from "@/lib/session";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export default async function AttendanceHistoryPage(props: PageProps<"/app/attendance">) {
  const session = await requireEmployee();
  const employee = getEmployeeByUserId(session.userId);

  if (!employee) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <div className="card">No employee profile linked to this account.</div>
      </main>
    );
  }

  const params = await props.searchParams;
  const requested = typeof params.month === "string" ? params.month : "";
  const currentMonth = toWorkDate().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(requested) ? requested : currentMonth;

  const { days, summary } = getMonthEvaluations(employee.id, `${month}-01`);
  const ordered = [...days].reverse();
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const canGoNext = nextMonth <= currentMonth;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6">
      <Link
        href="/app"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Attendance history</h1>
          <p className="mt-1 text-sm text-slate-600">{employee.full_name} • {employee.employee_code}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/app/attendance?month=${prevMonth}`} className="btn btn-sm btn-ghost">
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </Link>
          <span className="min-w-[8rem] text-center text-sm font-semibold text-slate-800">{monthLabel(`${month}-01`)}</span>
          {canGoNext ? (
            <Link href={`/app/attendance?month=${nextMonth}`} className="btn btn-sm btn-ghost">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="btn btn-sm btn-ghost pointer-events-none opacity-40">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
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
            weekends: {summary.weekendDays} • holidays: {summary.holidayDays}
          </p>
        </div>
        <div className="card-tight">
          <p className="stat-label">Hours</p>
          <p className="stat-value">{formatHours(summary.workedHours)}</p>
          <p className="text-[11px] text-slate-500">overtime: {formatHours(summary.overtimeHours)}</p>
        </div>
      </section>

      <section className="mt-5 card">
        <p className="section-title flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" /> Daily log
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] tracking-wide text-slate-500 uppercase">
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 pr-3 font-semibold">Check-in</th>
                <th className="py-2 pr-3 font-semibold">Check-out</th>
                <th className="py-2 pr-3 font-semibold">Hours</th>
                <th className="py-2 font-semibold">Late</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((day) => (
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
                  <td className="py-2.5 pr-3 text-slate-700">{formatHours(day.hours)}</td>
                  <td className="py-2.5 text-slate-700">{day.lateMinutes ? `${day.lateMinutes} min` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
          <TrendingUp className="h-3 w-3" />
          Avg check-in {formatTime12(summary.averageCheckIn)} • avg check-out {formatTime12(summary.averageCheckOut)} •
          future dates are shown as “Upcoming” and never counted as absence.
        </p>
      </section>
    </main>
  );
}
