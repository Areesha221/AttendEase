import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import StaffActions from "./staff-actions";
import StaffForm from "./staff-form";
import { all } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/roles";
import { requireAdmin } from "@/lib/session";
import { effectiveRole } from "@/lib/session-core";
import type { StaffAccount } from "@/lib/staff-accounts";
import { formatStamp12 } from "@/lib/time";

export const metadata = { title: "Staff accounts — AttendEase" };

const ROLE_SUMMARY = [
  {
    role: "admin" as const,
    detail: "Everything: employees, attendance, leave, gate, reports, staff accounts and settings.",
  },
  {
    role: "hr" as const,
    detail: "Employees, attendance review, leave approvals and the gate. No reports or staff accounts.",
  },
  {
    role: "manager" as const,
    detail: "Company-wide dashboard, attendance, leave approvals and reports. No employee edits.",
  },
];

export default async function TeamPage(props: {
  searchParams: Promise<{ created?: string | string[] }>;
}) {
  const session = await requireAdmin();
  const params = await props.searchParams;
  const created = Array.isArray(params.created) ? params.created[0] === "1" : params.created === "1";

  const accounts = await all<StaffAccount>(
    `SELECT u.id, u.email, u.role, u.access_role,
            COALESCE(NULLIF(u.display_name, ''), e.full_name) AS display_name,
            u.is_active, u.created_at
     FROM users u
     LEFT JOIN employees e ON e.user_id = u.id
     WHERE u.access_role IN ('admin', 'hr', 'manager') OR u.role = 'boss'
     ORDER BY u.created_at ASC`,
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6">
      <Link
        href="/boss"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <header className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900 text-white">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-black text-slate-900">Staff accounts</h1>
          <p className="text-sm text-slate-600">
            Admin only. Create HR or manager logins and control who can sign in.
          </p>
        </div>
      </header>

      {created && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          Staff account created. Share the email and starting password privately.
        </p>
      )}

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        {ROLE_SUMMARY.map((item) => (
          <div key={item.role} className="card-tight">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{ROLE_LABELS[item.role]}</p>
            <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section>
          <h2 className="mb-3 text-sm font-bold text-slate-900">Current staff</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {accounts.map((account) => {
                const role = effectiveRole(account.role, account.access_role);
                const isActive = account.is_active === 1;
                const isSelf = account.id === session.userId;
                const name =
                  account.display_name?.trim() ||
                  account.email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) =>
                    letter.toUpperCase(),
                  );

                return (
                  <li key={account.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {name}
                        {isSelf && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                            you
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500">{account.email}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-900">
                          {ROLE_LABELS[role]}
                        </span>
                        <span className={isActive ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                          {isActive ? "Active" : "Deactivated"}
                        </span>
                        <span>· added {formatStamp12(account.created_at)}</span>
                      </p>
                    </div>

                    {role === "admin" && isSelf ? (
                      <p className="text-[11px] text-slate-400">Owner account</p>
                    ) : (
                      <StaffActions
                        userId={account.id}
                        email={account.email}
                        isActive={isActive}
                        isSelf={isSelf}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <StaffForm />
      </div>

      <p className="mt-5 text-[11px] text-slate-500">
        Deactivated accounts cannot sign in. Every create, activate, deactivate and password reset is written
        to the audit log.
      </p>
    </main>
  );
}
