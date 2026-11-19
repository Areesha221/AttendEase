import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, KeyRound, Wallet } from "lucide-react";
import Avatar from "@/components/avatar";
import EmployeeAdminActions from "@/components/employee-admin-actions";
import ResetPasswordForm from "@/components/reset-password-form";
import StatusBadge from "@/components/status-badge";
import { LEAVE_STATUS_META, LEAVE_TYPE_META, type LeaveType } from "@/lib/leave-shared";
import { TONE_CLASSES, eventClock, formatPkr } from "@/lib/rules";
import {
  getEmployeeById,
  getLeaveBalance,
  getMonthEvaluations,
  getPayrollView,
  listEmployeeLeaves,
} from "@/lib/queries";
import {
  formatDateHuman,
  formatHours,
  formatStamp12,
  formatTime12,
  maskCnic,
  monthLabel,
  toWorkDate,
  weekdayName,
} from "@/lib/time";
import { requireHr } from "@/lib/session";
import { notFound } from "next/navigation";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export default async function EmployeeDetailPage(props: PageProps<"/boss/employees/[id]">) {
  const session = await requireHr();

  const { id } = await props.params;
  const employee = await getEmployeeById(id);
  if (!employee) notFound();

  const params = await props.searchParams;
  const requested = typeof params.month === "string" ? params.month : "";
  const currentMonth = toWorkDate().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(requested) ? requested : currentMonth;

  const { days, summary } = await getMonthEvaluations(employee.id, `${month}-01`);
  const ordered = [...days].reverse();
  const balance = await getLeaveBalance(employee.id);
  const payroll = await getPayrollView(employee.id, `${month}-01`);
  const leaves = (await listEmployeeLeaves(employee.id)).slice(0, 6);
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const canGoNext = nextMonth <= currentMonth;

  const details: { label: string; value: string }[] = [
    { label: "Employee code", value: employee.employee_code },
    { label: "CNIC", value: maskCnic(employee.cnic) },
    { label: "Department", value: employee.department ?? "—" },
    { label: "Job title", value: employee.job_title ?? "—" },
    { label: "Joining date", value: formatDateHuman(employee.joining_date) },
    { label: "Monthly salary", value: formatPkr(employee.monthly_salary) },
    { label: "Phone", value: employee.phone ?? "—" },
    { label: "Account", value: employee.status === "active" ? "Active" : "Inactive" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <Link
        href="/boss/employees"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to employees
      </Link>

      <header className="card flex flex-wrap items-center gap-4">
        <Avatar src={employee.photo} name={employee.full_name} size={64} />
        <div className="min-w-[12rem] flex-1">
          <h1 className="text-lg font-black text-slate-900">{employee.full_name}</h1>
          <p className="text-sm text-slate-600">
            {employee.job_title ?? "—"} • {employee.department ?? "Unassigned"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {employee.employee_code} • CNIC {maskCnic(employee.cnic)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`badge ${
              employee.status === "active" ? TONE_CLASSES.green : TONE_CLASSES.slate
            }`}
          >
            {employee.status === "active" ? "Active" : "Inactive"}
          </span>
          <Link href={`/boss/employees/${employee.id}/edit`} className="btn btn-sm btn-ghost">
            Edit
          </Link>
        </div>
      </header>

      <EmployeeAdminActions
        employeeId={employee.id}
        employeeName={employee.full_name}
        status={employee.status}
        canModify={employee.user_id !== session.userId}
        canDelete={session.role === "admin"}
      />

      <section className="card mt-4">
        <p className="section-title flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5" /> Reset login password
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Set a new password for {employee.full_name}. They can change it themselves later from My Profile.
        </p>
        <ResetPasswordForm employeeId={employee.id} employeeName={employee.full_name} />
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {details.map((detail) => (
          <div key={detail.label} className="card-tight">
            <p className="stat-label">{detail.label}</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{detail.value}</p>
          </div>
        ))}
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-800">{monthLabel(`${month}-01`)}</p>
        <div className="flex items-center gap-2">
          <Link href={`/boss/employees/${employee.id}?month=${prevMonth}`} className="btn btn-sm btn-ghost">
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </Link>
          {canGoNext ? (
            <Link href={`/boss/employees/${employee.id}?month=${nextMonth}`} className="btn btn-sm btn-ghost">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="btn btn-sm btn-ghost pointer-events-none opacity-40">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>

      <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="card">
          <p className="section-title">Daily log</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
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
        </div>

        <div className="space-y-4">
          <div className="card">
            <p className="section-title flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5" /> Salary estimate
            </p>
            {payroll ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-600">Monthly salary</dt>
                  <dd className="font-semibold text-slate-800">{formatPkr(payroll.payroll.monthlySalary)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Daily rate ({payroll.payroll.workDaysPerMonth} days)</dt>
                  <dd className="text-slate-700">{formatPkr(payroll.payroll.dailyRate)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Late penalty ({payroll.payroll.lateCount}×)</dt>
                  <dd className="text-rose-600">− {formatPkr(payroll.payroll.lateTotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Absence deduction ({payroll.payroll.absentDays} days)</dt>
                  <dd className="text-rose-600">− {formatPkr(payroll.payroll.absenceTotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Unpaid leave ({payroll.payroll.unpaidLeaveDays} days)</dt>
                  <dd className="text-rose-600">− {formatPkr(payroll.payroll.unpaidLeaveTotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Bonus</dt>
                  <dd className="text-emerald-600">+ {formatPkr(payroll.payroll.bonusAmount)}</dd>
                </div>
                <div className="mt-1 flex justify-between border-t border-slate-200 pt-2">
                  <dt className="font-bold text-slate-800">Estimated net</dt>
                  <dd className="font-bold text-slate-900">{formatPkr(payroll.payroll.estimatedNet)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-xs text-slate-500">No payroll data.</p>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Estimate only — approved, entitled leave is never penalised as absence.
            </p>
          </div>

          <div className="card">
            <p className="section-title">Leave balance {toWorkDate().slice(0, 4)}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Annual remaining</dt>
                <dd className="font-semibold text-slate-800">
                  {balance.annualRemaining} of {balance.entitlement + balance.carryForward}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Annual used / pending</dt>
                <dd className="text-slate-700">
                  {balance.annualUsed} / {balance.annualPending}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Sick / Casual used</dt>
                <dd className="text-slate-700">
                  {balance.sickUsed} / {balance.casualUsed}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Unpaid used</dt>
                <dd className="text-slate-700">{balance.unpaidUsed}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="mt-5 card">
        <p className="section-title">Recent leave requests</p>
        <ul className="mt-3 space-y-2">
          {leaves.map((leave) => {
            const meta = LEAVE_STATUS_META[leave.status] ?? { label: leave.status, tone: "slate" };
            const typeLabel = LEAVE_TYPE_META[leave.type as LeaveType]?.label ?? leave.type;
            return (
              <li key={leave.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {typeLabel}
                    {leave.emergency ? " • Emergency" : ""}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {formatDateHuman(leave.start_date)} → {formatDateHuman(leave.end_date)} • {leave.days} day(s)
                  </p>
                  {leave.reason && <p className="mt-0.5 text-[11px] text-slate-500">{leave.reason}</p>}
                </div>
                <div className="text-right">
                  <span className={`badge ${TONE_CLASSES[meta.tone]}`}>{meta.label}</span>
                  {leave.approved_at && (
                    <p className="mt-1 text-[10px] text-slate-400">Decided {formatStamp12(leave.approved_at)}</p>
                  )}
                </div>
              </li>
            );
          })}
          {leaves.length === 0 && <li className="text-xs text-slate-500">No leave requests this year.</li>}
        </ul>
      </section>
    </main>
  );
}
