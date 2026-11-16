import Link from "next/link";
import { ArrowLeft, CalendarDays, Plane } from "lucide-react";
import LeaveForm from "@/components/leave-form";
import { cancelLeaveAction } from "@/lib/leave";
import { LEAVE_STATUS_META, LEAVE_TYPE_META, type LeaveType } from "@/lib/leave-shared";
import { TONE_CLASSES } from "@/lib/rules";
import { getAllHolidays, getEmployeeByUserId, getLeaveBalance, getSettings, listEmployeeLeaves } from "@/lib/queries";
import { formatDateHuman, toWorkDate } from "@/lib/time";
import { requireEmployee } from "@/lib/session";

export default async function LeavePage() {
  const session = await requireEmployee();
  const employee = await getEmployeeByUserId(session.userId);

  if (!employee) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <div className="card">No employee profile linked to this account.</div>
      </main>
    );
  }

  const settings = await getSettings();
  const holidays = (await getAllHolidays()).map((row) => row.date);
  const requests = await listEmployeeLeaves(employee.id);
  const balance = await getLeaveBalance(employee.id);
  const today = toWorkDate();

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
          <h1 className="text-xl font-black text-slate-900">Leave request</h1>
          <p className="mt-1 text-sm text-slate-600">
            Annual leave left: <strong>{balance.annualRemaining}</strong> of{" "}
            {balance.entitlement + balance.carryForward} days
          </p>
        </div>
        <Link href="/app/leave/balance" className="btn btn-sm btn-ghost">
          <CalendarDays className="h-3.5 w-3.5" /> Full balance
        </Link>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <LeaveForm weekendDays={settings.weekend_days} holidays={holidays} today={today} />
        </div>

        <div className="card">
          <p className="section-title flex items-center gap-2">
            <Plane className="h-3.5 w-3.5" /> Your requests this year
          </p>
          <ul className="mt-3 space-y-2">
            {requests.map((request) => {
              const meta = LEAVE_STATUS_META[request.status] ?? { label: request.status, tone: "slate" };
              const typeLabel = LEAVE_TYPE_META[request.type as LeaveType]?.label ?? request.type;
              const cancellable = request.status === "pending" || request.status === "submitted";
              return (
                <li key={request.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {typeLabel}
                        {request.emergency ? " • Emergency" : ""}
                      </p>
                      <p className="text-xs text-slate-600">
                        {formatDateHuman(request.start_date)} → {formatDateHuman(request.end_date)} •{" "}
                        {request.days} day(s)
                      </p>
                      {request.reason && <p className="mt-1 text-xs text-slate-500">{request.reason}</p>}
                      {request.comment && (
                        <p className="mt-1 text-xs text-slate-500">Boss: {request.comment}</p>
                      )}
                    </div>
                    <span className={`badge ${TONE_CLASSES[meta.tone]}`}>{meta.label}</span>
                  </div>
                  {cancellable && (
                    <form action={cancelLeaveAction} className="mt-2">
                      <input type="hidden" name="leave_id" value={request.id} />
                      <button type="submit" className="btn btn-sm btn-ghost">
                        Cancel request
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
            {requests.length === 0 && <li className="text-xs text-slate-500">No leave requests yet.</li>}
          </ul>
        </div>
      </div>
    </main>
  );
}
