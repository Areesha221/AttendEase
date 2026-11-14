import Link from "next/link";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Plane,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import Avatar from "@/components/avatar";
import StatusBadge from "@/components/status-badge";
import {
  countPendingSync,
  getEmployeeByUserId,
  getEventsForDate,
  getLeaveBalance,
  getMonthEvaluations,
  getPayrollView,
  getSettings,
  listNotifications,
} from "@/lib/queries";
import { eventClock } from "@/lib/rules";
import { formatDateLong, formatHours, formatTime12, maskCnic, toWorkDate } from "@/lib/time";
import { requireEmployee } from "@/lib/session";

export default async function EmployeeHomePage() {
  const session = await requireEmployee();
  const employee = getEmployeeByUserId(session.userId);

  if (!employee) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-16">
        <div className="card">
          <p className="font-semibold text-slate-900">No employee profile linked to this account.</p>
          <p className="mt-1 text-sm text-slate-600">Ask your administrator to register your profile.</p>
        </div>
      </main>
    );
  }

  const settings = getSettings();
  const workDate = toWorkDate();
  const todayEvents = getEventsForDate(employee.id, workDate).filter(
    (event) => event.review_status !== "rejected",
  );
  const { days, summary } = getMonthEvaluations(employee.id, workDate);
  const today = days.find((day) => day.workDate === workDate);
  const balance = getLeaveBalance(employee.id);
  const payroll = getPayrollView(employee.id, workDate);
  const notifications = listNotifications(session.userId, 4);
  const pendingSync = countPendingSync(employee.id);

  const checkIn = todayEvents.find((event) => event.type === "check_in") ?? null;
  const checkOut = todayEvents.find((event) => event.type === "check_out") ?? null;
  const isWeekendDay = today?.status === "weekend";
  const isHoliday = today?.status === "holiday";
  const beforeJoining = today?.status === "before_joining";

  const quickLinks = [
    { href: "/app/attendance", label: "Attendance history", icon: CalendarCheck },
    { href: "/app/leave", label: "Leave request", icon: Plane },
    { href: "/app/leave/balance", label: "Leave balance", icon: CalendarDays },
    { href: "/app/profile", label: "My profile", icon: UserRound },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6">
      <header className="card flex flex-wrap items-center gap-4">
        <Avatar src={employee.photo} name={employee.full_name} size={64} />
        <div className="min-w-[12rem] flex-1">
          <p className="text-lg font-bold text-slate-900">{employee.full_name}</p>
          <p className="text-sm text-slate-600">
            {employee.job_title} • {employee.department}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500">
            {employee.employee_code} • CNIC {maskCnic(employee.cnic)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={today?.status ?? "absent"} />
          <p className="text-[11px] text-slate-500">Server time · Asia/Karachi</p>
        </div>
      </header>

      {pendingSync > 0 && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
          {pendingSync} attendance event(s) were captured offline and are still waiting to sync. They will upload
          automatically when you are back online.
        </p>
      )}

      <section className="mt-5 card">
        <p className="section-title">Quick action</p>
        {beforeJoining ? (
          <p className="mt-3 text-sm text-slate-600">
            Your attendance starts from {employee.joining_date ? formatDateLong(employee.joining_date) : "your joining date"}.
            Days before that are not counted as absence.
          </p>
        ) : isWeekendDay || isHoliday ? (
          <p className="mt-3 text-sm text-slate-600">
            Today is a {isWeekendDay ? "weekend" : "public holiday"} — no check-in is required.
          </p>
        ) : !checkIn ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href="/app/check-in" className="btn btn-success">
              <LogIn className="h-4 w-4" /> Check in now
            </Link>
            <span className="text-sm text-slate-500">Take a selfie and verify your location to start the day.</span>
          </div>
        ) : !checkOut ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href="/app/check-out" className="btn btn-primary">
              <LogOut className="h-4 w-4" /> Check out now
            </Link>
            <span className="text-sm text-slate-500">
              Checked in at {formatTime12(eventClock(checkIn))}. Remember to check out before you leave.
            </span>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">Attendance complete for today</span>
            <span className="text-sm text-slate-500">
              {formatTime12(eventClock(checkIn))} → {formatTime12(eventClock(checkOut))} ·{" "}
              {formatHours(today?.hours)}
            </span>
          </div>
        )}
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card">
          <p className="section-title flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" /> Today — {formatDateLong(workDate)}
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Check-in</span>
              <span className="font-semibold text-slate-900">{formatTime12(eventClock(checkIn))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Check-out</span>
              <span className="font-semibold text-slate-900">{formatTime12(eventClock(checkOut))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Working hours</span>
              <span className="font-semibold text-slate-900">{formatHours(today?.hours)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Late by</span>
              <span className="font-semibold text-slate-900">
                {today?.lateMinutes ? `${today.lateMinutes} min` : "—"}
              </span>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
            <MapPin className="h-3 w-3" />
            Office: {settings.office_name} • allowed radius {settings.radius_m} m
          </p>
        </div>

        <div className="card">
          <p className="section-title flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" /> This month
          </p>
          <p className="stat-value mt-2">{summary.attendancePercentage}%</p>
          <p className="stat-label">attendance percentage</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">On time: {summary.onTimeDays}</div>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-700">Late: {summary.lateDays}</div>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-700">Absent: {summary.absentDays}</div>
            <div className="rounded-lg bg-sky-50 p-2 text-sky-700">Leave: {summary.leaveDays}</div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Avg check-in {formatTime12(summary.averageCheckIn)} • avg check-out{" "}
            {formatTime12(summary.averageCheckOut)} • overtime {formatHours(summary.overtimeHours)}
          </p>
          <Link href="/app/attendance" className="mt-3 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            View attendance history →
          </Link>
        </div>

        <div className="card">
          <p className="section-title flex items-center gap-2">
            <Plane className="h-3.5 w-3.5" /> Leave balance {workDate.slice(0, 4)}
          </p>
          <p className="stat-value mt-2">{balance.annualRemaining}</p>
          <p className="stat-label">annual days left of {balance.entitlement + balance.carryForward}</p>
          <div className="mt-3 space-y-1.5 text-xs text-slate-600">
            <p>Approved used: {balance.annualUsed} days</p>
            <p>Waiting approval: {balance.annualPending} days</p>
            <p>Sick used: {balance.sickUsed} • Casual used: {balance.casualUsed}</p>
          </div>
          <Link href="/app/leave" className="mt-3 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            Request leave →
          </Link>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <p className="section-title flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5" /> Estimated salary adjustment
          </p>
          {payroll && (
            <>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Monthly salary</span>
                  <span className="font-semibold">Rs. {payroll.payroll.monthlySalary.toLocaleString("en-PK")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Daily rate ({payroll.payroll.workDaysPerMonth} working days)</span>
                  <span className="font-semibold">Rs. {payroll.payroll.dailyRate.toLocaleString("en-PK")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Late penalty ({payroll.payroll.lateCount} × {settings.late_penalty})
                  </span>
                  <span className="font-semibold text-rose-600">
                    − Rs. {payroll.payroll.lateTotal.toLocaleString("en-PK")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Absence deduction ({payroll.payroll.absentDays} days)</span>
                  <span className="font-semibold text-rose-600">
                    − Rs. {payroll.payroll.absenceTotal.toLocaleString("en-PK")}
                  </span>
                </div>
                {payroll.payroll.unpaidLeaveTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Unpaid leave ({payroll.unpaidLeaveDays} days)</span>
                    <span className="font-semibold text-rose-600">
                      − Rs. {payroll.payroll.unpaidLeaveTotal.toLocaleString("en-PK")}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Bonus (if approved)</span>
                  <span className="font-semibold text-emerald-600">
                    + Rs. {payroll.payroll.bonusAmount.toLocaleString("en-PK")}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-700">Estimated net</span>
                  <span className="font-bold text-slate-900">
                    Rs. {payroll.payroll.estimatedNet.toLocaleString("en-PK")}
                  </span>
                </div>
              </div>
              <p className="mt-3 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500">
                Estimated only — pending approval. Approved, entitled leave is never penalised as absence.
              </p>
            </>
          )}
        </div>

        <div className="card">
          <p className="section-title flex items-center gap-2">
            <Bell className="h-3.5 w-3.5" /> Notifications
          </p>
          <ul className="mt-3 space-y-2">
            {notifications.map((notification) => (
              <li key={notification.id} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
                <p className="mt-0.5 text-xs text-slate-600">{notification.body}</p>
              </li>
            ))}
            {notifications.length === 0 && <li className="text-xs text-slate-500">No notifications yet.</li>}
          </ul>
        </div>
      </section>

      <section className="mt-5 card">
        <p className="section-title">More</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <Icon className="h-4 w-4 text-indigo-600" />
                {link.label}
              </Link>
            );
          })}
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="h-3 w-3" />
          Consent on file for photo, location, CNIC and attendance storage (captured at registration).
        </p>
      </section>
    </main>
  );
}
