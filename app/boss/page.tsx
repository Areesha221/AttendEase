import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Clock,
  MapPin,
  RefreshCw,
  ScanFace,
  Wallet,
} from "lucide-react";
import Avatar from "@/components/avatar";
import LeaveDecision from "@/components/leave-decision";
import AttendanceTrendChart from "@/components/charts/attendance-trend-chart";
import DepartmentBarChart from "@/components/charts/department-bar-chart";
import { TONE_CLASSES } from "@/lib/rules";
import {
  getBossOverview,
  getMonthlyTrend,
  listAuditLogs,
  listDayAttendance,
  listLeaves,
  listNotifications,
} from "@/lib/queries";
import { formatDateHuman, formatStamp12, formatTime12, toClock } from "@/lib/time";
import { requireBoss } from "@/lib/session";

export default async function BossHomePage() {
  const session = await requireBoss();
  const overview = await getBossOverview();
  const pendingLeaves = await listLeaves({ status: "pending", limit: 5 });
  const audit = await listAuditLogs(6);
  const notifications = await listNotifications(session.userId, 3);
  const trend = await getMonthlyTrend();
  const liveFeed = (await listDayAttendance()).slice(0, 6);

  const stats = [
    { label: "Total employees", value: overview.totalEmployees, tone: "text-slate-900" },
    { label: "Present today", value: overview.presentToday, tone: "text-emerald-600" },
    { label: "Checked in now", value: overview.checkedInNow, tone: "text-indigo-600" },
    { label: "Not checked out", value: overview.notCheckedOut, tone: "text-amber-600" },
    { label: "Absent today", value: overview.absentToday, tone: "text-rose-600" },
    { label: "On leave today", value: overview.onLeaveToday, tone: "text-sky-600" },
    { label: "Late today", value: overview.lateToday, tone: "text-amber-600" },
    { label: "Pending leave requests", value: overview.pendingLeaves, tone: "text-amber-600" },
    { label: "Month attendance %", value: `${overview.attendancePercentage}%`, tone: "text-slate-900" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-black text-slate-900">Boss dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live view for {formatDateHuman(overview.workDate)} (Asia/Karachi)
          </p>
        </div>
        <Link href="/boss/reports" className="btn btn-sm btn-ghost">
          Open reports <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="card-tight">
            <p className="stat-label">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold ${stat.tone}`}>{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card-tight flex items-center gap-3">
          <Wallet className="h-5 w-5 text-rose-500" />
          <div>
            <p className="stat-label">Late deductions this month</p>
            <p className="text-lg font-bold text-slate-900">
              Rs. {overview.totalLateDeduction.toLocaleString("en-PK")}
            </p>
          </div>
        </div>
        <div className="card-tight flex items-center gap-3">
          <BadgeCheck className="h-5 w-5 text-emerald-500" />
          <div>
            <p className="stat-label">Perfect-attendance bonuses</p>
            <p className="text-lg font-bold text-slate-900">
              Rs. {overview.totalApprovedBonuses.toLocaleString("en-PK")}
            </p>
          </div>
        </div>
        <div className="card-tight flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-amber-500" />
          <div>
            <p className="stat-label">Offline events waiting to sync</p>
            <p className="text-lg font-bold text-slate-900">{overview.pendingSyncEvents}</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="card">
          <p className="section-title">Company attendance this month</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Present, late and absent counts per working day (weekends and holidays excluded).
          </p>
          <div className="mt-3">
            <AttendanceTrendChart data={trend} />
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

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="section-title flex items-center gap-2">
              <ScanFace className="h-3.5 w-3.5" /> Live attendance feed (today)
            </p>
            <Link href="/boss/attendance" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              View all
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {liveFeed.map((event) => (
              <div key={event.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
                <Avatar src={event.photo} name={event.employee_name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {event.employee_name}{" "}
                    <span className="font-normal text-slate-500">({event.employee_code})</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {event.type === "check_in" ? "Checked in" : "Checked out"} at{" "}
                    {formatStamp12(event.server_time)} • {event.department ?? "Unassigned"}
                  </p>
                </div>
                <span
                  className={`badge ${
                    event.verification === "flagged"
                      ? TONE_CLASSES.red
                      : event.verification === "pending"
                        ? TONE_CLASSES.yellow
                        : TONE_CLASSES.green
                  }`}
                >
                  {event.location_status === "outside" ? (
                    <MapPin className="h-3 w-3" />
                  ) : null}
                  {event.verification}
                </span>
              </div>
            ))}
            {liveFeed.length === 0 && <p className="text-xs text-slate-500">No attendance recorded today yet.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <p className="section-title flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" /> Leave requests to decide
              </p>
              <Link href="/boss/leave" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                Manage
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {pendingLeaves.map((leave) => (
                <div key={leave.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={leave.photo} name={leave.employee_name ?? "Employee"} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {leave.employee_name}{" "}
                        <span className="font-normal text-slate-500">({leave.employee_code})</span>
                      </p>
                      <p className="text-[11px] text-slate-600">
                        {leave.type} • {formatDateHuman(leave.start_date)} → {formatDateHuman(leave.end_date)} •{" "}
                        {leave.days} day(s)
                        {leave.emergency ? " • EMERGENCY" : ""}
                      </p>
                    </div>
                  </div>
                  {leave.reason && <p className="mt-1 text-[11px] text-slate-500">{leave.reason}</p>}
                  <div className="mt-2">
                    <LeaveDecision leaveId={leave.id} />
                  </div>
                </div>
              ))}
              {pendingLeaves.length === 0 && (
                <p className="text-xs text-slate-500">Nothing pending. All caught up.</p>
              )}
            </div>
          </div>

          <div className="card">
            <p className="section-title flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Recent audit log
            </p>
            <ul className="mt-3 space-y-2 text-xs">
              {audit.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-slate-200 p-2.5">
                  <p className="font-semibold text-slate-700">
                    {entry.actor_name} — {entry.action} {entry.entity}
                  </p>
                  <p className="mt-0.5 text-slate-500">{entry.details}</p>
                  <p className="mt-0.5 text-slate-400">{formatStamp12(entry.created_at)}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <p className="section-title">Notifications</p>
          <ul className="mt-3 space-y-2">
            {notifications.map((notification) => (
              <li key={notification.id} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
                <p className="mt-0.5 text-xs text-slate-600">{notification.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <p className="section-title flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Needs your attention
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <span className="text-slate-700">Employees still to check out</span>
              <span className="font-bold text-amber-600">{overview.notCheckedOut}</span>
            </li>
            <li className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <span className="text-slate-700">Offline events waiting to sync</span>
              <span className="font-bold text-amber-600">{overview.pendingSyncEvents}</span>
            </li>
            <li className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <span className="text-slate-700">Pending leave requests</span>
              <span className="font-bold text-amber-600">{overview.pendingLeaves}</span>
            </li>
            <li className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <span className="text-slate-700">Server time (Asia/Karachi)</span>
              <span className="font-bold text-slate-700">{formatTime12(toClock())}</span>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
