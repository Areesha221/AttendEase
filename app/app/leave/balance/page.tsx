import Link from "next/link";
import { ArrowLeft, CalendarDays, HeartPulse, Plane, Wallet, Zap } from "lucide-react";
import { getEmployeeByUserId, getLeaveBalance } from "@/lib/queries";
import { formatDateHuman, toWorkDate } from "@/lib/time";
import { requireEmployee } from "@/lib/session";
import { LEAVE_STATUS_META, LEAVE_TYPE_META, type LeaveType } from "@/lib/leave-shared";
import { TONE_CLASSES } from "@/lib/rules";
import { listEmployeeLeaves } from "@/lib/queries";

export default async function LeaveBalancePage() {
  const session = await requireEmployee();
  const employee = getEmployeeByUserId(session.userId);

  if (!employee) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <div className="card">No employee profile linked to this account.</div>
      </main>
    );
  }

  const year = toWorkDate().slice(0, 4);
  const balance = getLeaveBalance(employee.id, year);
  const requests = listEmployeeLeaves(employee.id, year);

  const cards = [
    { label: "Annual remaining", value: balance.annualRemaining, hint: `of ${balance.entitlement + balance.carryForward} days`, tone: "text-emerald-600" },
    { label: "Annual used", value: balance.annualUsed, hint: "approved", tone: "text-slate-900" },
    { label: "Waiting approval", value: balance.annualPending, hint: "annual days", tone: "text-amber-600" },
    { label: "Carry forward", value: balance.carryForward, hint: "from last year", tone: "text-slate-900" },
  ];

  const other = [
    { label: "Sick used", value: balance.sickUsed, icon: HeartPulse },
    { label: "Casual used", value: balance.casualUsed, icon: CalendarDays },
    { label: "Emergency used", value: balance.emergencyUsed, icon: Zap },
    { label: "Unpaid used", value: balance.unpaidUsed, icon: Wallet },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6">
      <Link
        href="/app/leave"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to leave request
      </Link>

      <h1 className="text-xl font-black text-slate-900">Leave balance {year}</h1>
      <p className="mt-1 text-sm text-slate-600">{employee.full_name} • {employee.employee_code}</p>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="card-tight">
            <p className="stat-label">{card.label}</p>
            <p className={`stat-value ${card.tone}`}>{card.value}</p>
            <p className="text-[11px] text-slate-500">{card.hint}</p>
          </div>
        ))}
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {other.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="card-tight flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-lg font-bold text-slate-900">{item.value}</p>
                <p className="text-[11px] text-slate-500">{item.label}</p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-5 card">
        <p className="section-title flex items-center gap-2">
          <Plane className="h-3.5 w-3.5" /> History {year}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] tracking-wide text-slate-500 uppercase">
                <th className="py-2 pr-3 font-semibold">Type</th>
                <th className="py-2 pr-3 font-semibold">Dates</th>
                <th className="py-2 pr-3 font-semibold">Days</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const meta = LEAVE_STATUS_META[request.status] ?? { label: request.status, tone: "slate" };
                const typeLabel = LEAVE_TYPE_META[request.type as LeaveType]?.label ?? request.type;
                return (
                  <tr key={request.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-slate-800">
                      {typeLabel}
                      {request.emergency ? " • Emergency" : ""}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700">
                      {formatDateHuman(request.start_date)} → {formatDateHuman(request.end_date)}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700">{request.days}</td>
                    <td className="py-2.5">
                      <span className={`badge ${TONE_CLASSES[meta.tone]}`}>{meta.label}</span>
                    </td>
                  </tr>
                );
              })}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-xs text-slate-500">
                    No leave requests this year.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Unpaid leave is deducted from salary. Approved paid leave is never counted as absence.
        </p>
      </section>
    </main>
  );
}
