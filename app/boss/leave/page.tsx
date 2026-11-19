import Link from "next/link";
import { AlertTriangle, CalendarCheck } from "lucide-react";
import Avatar from "@/components/avatar";
import LeaveDecision from "@/components/leave-decision";
import { LEAVE_STATUS_META, LEAVE_TYPE_META, type LeaveType } from "@/lib/leave-shared";
import { TONE_CLASSES } from "@/lib/rules";
import { listLeaves } from "@/lib/queries";
import { formatDateHuman, formatStamp12 } from "@/lib/time";
import { requireStaff } from "@/lib/session";

const TABS = [
  { key: "pending", label: "Awaiting decision" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;

export default async function BossLeavePage(props: PageProps<"/boss/leave">) {
  await requireStaff();

  const params = await props.searchParams;
  const status = typeof params.status === "string" ? params.status : "pending";
  const activeTab = TABS.some((tab) => tab.key === status) ? status : "pending";

  const pendingCount = (await listLeaves({ status: "pending" })).length;
  const approvedCount = (await listLeaves({ status: "approved" })).length;
  const rejectedCount = (await listLeaves({ status: "rejected" })).length;
  const requests = await listLeaves({ status: activeTab, limit: 100 });

  const counts: Record<string, number> = {
    pending: pendingCount,
    approved: approvedCount,
    rejected: rejectedCount,
    all: pendingCount + approvedCount + rejectedCount,
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <div>
        <h1 className="text-xl font-black text-slate-900">Leave management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Approve or reject requests. Every decision is logged and the employee is notified.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/boss/leave?status=${tab.key}`}
            className={`badge ${
              activeTab === tab.key
                ? "bg-blue-900 text-white ring-blue-900"
                : "bg-slate-100 text-slate-600 ring-slate-200"
            }`}
          >
            {tab.label}
            <span className={activeTab === tab.key ? "text-blue-100" : "text-slate-400"}>
              {counts[tab.key] ?? 0}
            </span>
          </Link>
        ))}
      </div>

      <section className="mt-4 space-y-3">
        {requests.map((leave) => {
          const meta = LEAVE_STATUS_META[leave.status] ?? { label: leave.status, tone: "slate" };
          const typeLabel = LEAVE_TYPE_META[leave.type as LeaveType]?.label ?? leave.type;
          const isPending = leave.status === "pending" || leave.status === "submitted";
          return (
            <article key={leave.id} className="card-tight">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar src={leave.photo} name={leave.employee_name ?? "Employee"} size={44} />
                <div className="min-w-[12rem] flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {leave.employee_name}{" "}
                    <span className="font-normal text-slate-500">({leave.employee_code})</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    {typeLabel}
                    {leave.emergency ? " • EMERGENCY" : ""} • {formatDateHuman(leave.start_date)} →{" "}
                    {formatDateHuman(leave.end_date)} • {leave.days} day(s)
                  </p>
                  {leave.reason && <p className="mt-1 text-xs text-slate-500">{leave.reason}</p>}
                  {leave.comment && (
                    <p className="mt-1 text-xs text-slate-500">
                      Decision note: {leave.comment}
                      {leave.approved_at ? ` • ${formatStamp12(leave.approved_at)}` : ""}
                    </p>
                  )}
                </div>
                <span className={`badge ${TONE_CLASSES[meta.tone]}`}>{meta.label}</span>
              </div>

              {isPending ? (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <LeaveDecision leaveId={leave.id} />
                </div>
              ) : null}
            </article>
          );
        })}
        {requests.length === 0 && (
          <div className="card-tight flex items-center gap-2 text-xs text-slate-500">
            <CalendarCheck className="h-4 w-4" /> No leave requests in this tab.
          </div>
        )}
      </section>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500">
        <AlertTriangle className="h-3 w-3" /> Approved, entitled leave is never deducted from salary as absence;
        unpaid leave is deducted at the daily rate.
      </p>
    </main>
  );
}
