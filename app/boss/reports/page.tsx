import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, Download, Filter, Wallet } from "lucide-react";
import AttendanceTrendChart from "@/components/charts/attendance-trend-chart";
import DepartmentBarChart from "@/components/charts/department-bar-chart";
import StatusDonutChart from "@/components/charts/status-donut-chart";
import { TONE_CLASSES, formatPkr } from "@/lib/rules";
import {
  countFlaggedEvents,
  getBossOverview,
  getCompanyStatusTotals,
  getMonthlyTrend,
  getPayrollTotals,
  listAttendanceLog,
  listEmployees,
} from "@/lib/queries";
import { endOfMonth, formatDateHuman, formatStamp12, monthLabel, startOfMonth, toWorkDate } from "@/lib/time";
import { requireBoss } from "@/lib/session";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export default async function ReportsPage(props: PageProps<"/boss/reports">) {
  await requireBoss();

  const params = await props.searchParams;
  const today = toWorkDate();
  const currentMonth = today.slice(0, 7);
  const requestedMonth = typeof params.month === "string" ? params.month : "";
  const month = /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : currentMonth;
  const monthAnchor = `${month}-01`;

  const employeeFilter = typeof params.employee === "string" ? params.employee : "all";
  const start = isDate(params.start) ? params.start : startOfMonth(monthAnchor);
  const end = isDate(params.end) ? params.end : endOfMonth(monthAnchor);

  const employees = await listEmployees();
  const trend = await getMonthlyTrend(monthAnchor);
  const totals = await getCompanyStatusTotals(monthAnchor);
  const overview = await getBossOverview(monthAnchor === startOfMonth(today) ? today : monthAnchor);
  const payrollTotals = await getPayrollTotals(monthAnchor);
  const flagged = await countFlaggedEvents(startOfMonth(monthAnchor), endOfMonth(monthAnchor));
  const log = await listAttendanceLog({ employeeId: employeeFilter, start, end, limit: 200 });

  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const canGoNext = nextMonth <= currentMonth;

  const donut = [
    { name: "On time", value: totals.onTime, color: "#10b981" },
    { name: "Late", value: totals.late, color: "#f59e0b" },
    { name: "Absent", value: totals.absent, color: "#e11d48" },
    { name: "Leave", value: totals.leave, color: "#0ea5e9" },
  ];

  const payrollCards = [
    { label: "Late deductions", value: payrollTotals.lateDeductions, tone: "text-rose-600" },
    { label: "Absence + unpaid deductions", value: payrollTotals.absenceDeductions, tone: "text-rose-600" },
    { label: "Bonuses", value: payrollTotals.bonuses, tone: "text-emerald-600" },
    { label: "Estimated net payroll", value: payrollTotals.totalNet, tone: "text-slate-900" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-600">
            Attendance analytics and payroll estimates for {monthLabel(monthAnchor)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/boss/reports?month=${prevMonth}`} className="btn btn-sm btn-ghost">
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </Link>
          <span className="min-w-[8rem] text-center text-sm font-semibold text-slate-800">{monthLabel(monthAnchor)}</span>
          {canGoNext ? (
            <Link href={`/boss/reports?month=${nextMonth}`} className="btn btn-sm btn-ghost">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="btn btn-sm btn-ghost pointer-events-none opacity-40">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-tight">
          <p className="stat-label">Month attendance</p>
          <p className="stat-value">{overview.attendancePercentage}%</p>
          <p className="text-[11px] text-slate-500">across {overview.totalEmployees} employees</p>
        </div>
        <div className="card-tight">
          <p className="stat-label">Flagged locations</p>
          <p className="stat-value text-rose-600">{flagged}</p>
          <p className="text-[11px] text-slate-500">outside office radius this month</p>
        </div>
        <div className="card-tight">
          <p className="stat-label">Pending leave requests</p>
          <p className="stat-value text-amber-600">{overview.pendingLeaves}</p>
          <p className="text-[11px] text-slate-500">awaiting a decision</p>
        </div>
        <div className="card-tight">
          <p className="stat-label">Offline events to sync</p>
          <p className="stat-value text-amber-600">{overview.pendingSyncEvents}</p>
          <p className="text-[11px] text-slate-500">from the offline queue</p>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="card lg:col-span-2">
          <p className="section-title flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" /> Present / late / absent per working day
          </p>
          <div className="mt-3">
            <AttendanceTrendChart data={trend} />
          </div>
        </div>
        <div className="card">
          <p className="section-title">Month-to-date status mix</p>
          <div className="mt-3">
            <StatusDonutChart data={donut} />
          </div>
        </div>
        <div className="card">
          <p className="section-title">Attendance by department (today)</p>
          <div className="mt-3">
            <DepartmentBarChart
              data={overview.departmentTrends.map((t) => ({
                department: t.department,
                percentage: t.percentage,
                employees: t.employees,
              }))}
            />
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {payrollCards.map((card) => (
          <div key={card.label} className="card-tight flex items-center gap-3">
            <Wallet className="h-5 w-5 text-slate-400" />
            <div>
              <p className="stat-label">{card.label}</p>
              <p className={`text-lg font-bold ${card.tone}`}>{formatPkr(card.value)}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-5 card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="section-title flex items-center gap-2">
            <Filter className="h-3.5 w-3.5" /> Attendance log
          </p>
          <Link
            href={`/api/reports/attendance?start=${start}&end=${end}&employee=${employeeFilter}`}
            className="btn btn-sm btn-ghost"
            prefetch={false}
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Link>
        </div>

        <form className="mt-3 flex flex-wrap items-end gap-3" action="/boss/reports">
          <input type="hidden" name="month" value={month} />
          <div>
            <label className="label" htmlFor="employee">
              Employee
            </label>
            <select id="employee" name="employee" defaultValue={employeeFilter} className="input min-w-[12rem]">
              <option value="all">All employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name} ({employee.employee_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="start">
              From
            </label>
            <input id="start" type="date" name="start" defaultValue={start} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="end">
              To
            </label>
            <input id="end" type="date" name="end" defaultValue={end} className="input" />
          </div>
          <button type="submit" className="btn btn-primary">
            Apply
          </button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] tracking-wide text-slate-500 uppercase">
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pr-3 font-semibold">Employee</th>
                <th className="py-2 pr-3 font-semibold">Type</th>
                <th className="py-2 pr-3 font-semibold">Server time</th>
                <th className="py-2 pr-3 font-semibold">Distance</th>
                <th className="py-2 pr-3 font-semibold">Location</th>
                <th className="py-2 font-semibold">Verification</th>
              </tr>
            </thead>
            <tbody>
              {log.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 text-slate-700">{formatDateHuman(row.work_date)}</td>
                  <td className="py-2.5 pr-3">
                    <span className="font-medium text-slate-800">{row.employee_name}</span>
                    <span className="ml-1 text-[11px] text-slate-400">{row.employee_code}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-700">{row.type === "check_in" ? "Check-in" : "Check-out"}</td>
                  <td className="py-2.5 pr-3 text-slate-700">{formatStamp12(row.server_time)}</td>
                  <td className="py-2.5 pr-3 text-slate-700">{row.distance_m !== null ? `${row.distance_m} m` : "—"}</td>
                  <td className="py-2.5 pr-3 text-slate-700">{row.location_status ?? "—"}</td>
                  <td className="py-2.5">
                    <span
                      className={`badge ${
                        row.verification === "flagged"
                          ? TONE_CLASSES.red
                          : row.verification === "pending"
                            ? TONE_CLASSES.yellow
                            : TONE_CLASSES.green
                      }`}
                    >
                      {row.verification}
                    </span>
                    {row.sync_status === "pending" && (
                      <span className={`badge ml-1 ${TONE_CLASSES.yellow}`}>sync</span>
                    )}
                  </td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                    No attendance rows in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Showing up to 200 rows for {formatDateHuman(start)} → {formatDateHuman(end)}.
        </p>
      </section>
    </main>
  );
}
