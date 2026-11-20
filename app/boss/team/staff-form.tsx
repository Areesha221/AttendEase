"use client";

import { useActionState } from "react";
import { Loader2, ShieldPlus } from "lucide-react";
import { createStaffAction, type StaffFormState } from "@/lib/staff-accounts";

const INITIAL: StaffFormState = undefined;

export default function StaffForm() {
  const [state, formAction, pending] = useActionState<StaffFormState, FormData>(
    createStaffAction,
    INITIAL,
  );

  const fieldError = (field: string) => state?.fieldErrors?.[field];

  return (
    <form action={formAction} className="card space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Add a staff account</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          HR manages people, attendance and leave. A manager sees company-wide reports and can approve
          requests, but cannot edit employees or staff accounts.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="staff_name">
            Full name
          </label>
          <input id="staff_name" name="full_name" className="input" placeholder="Ayesha Khan" required />
          {fieldError("full_name") && <p className="mt-1 text-xs text-rose-700">{fieldError("full_name")}</p>}
        </div>

        <div>
          <label className="label" htmlFor="staff_role">
            Role
          </label>
          <select id="staff_role" name="access_role" className="input" defaultValue="hr">
            <option value="hr">HR Manager</option>
            <option value="manager">Manager</option>
          </select>
          {fieldError("access_role") && (
            <p className="mt-1 text-xs text-rose-700">{fieldError("access_role")}</p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="staff_email">
            Email
          </label>
          <input
            id="staff_email"
            name="email"
            type="email"
            className="input"
            placeholder="name@company.com"
            autoComplete="off"
            required
          />
          {fieldError("email") && <p className="mt-1 text-xs text-rose-700">{fieldError("email")}</p>}
        </div>

        <div>
          <label className="label" htmlFor="staff_password">
            Starting password
          </label>
          <input
            id="staff_password"
            name="password"
            type="password"
            className="input"
            placeholder="At least 6 characters"
            autoComplete="new-password"
            required
          />
          {fieldError("password") && <p className="mt-1 text-xs text-rose-700">{fieldError("password")}</p>}
        </div>

        <div>
          <label className="label" htmlFor="staff_salary">
            Monthly salary <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="staff_salary"
            name="monthly_salary"
            type="number"
            min="0"
            step="1"
            className="input"
            placeholder="e.g. 120000"
            inputMode="numeric"
          />
          {fieldError("monthly_salary") ? (
            <p className="mt-1 text-xs text-rose-700">{fieldError("monthly_salary")}</p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-400">
              HR and managers are company employees. You can edit this later from Employees.
            </p>
          )}
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldPlus className="h-4 w-4" />}
        {pending ? "Creating account…" : "Create staff account"}
      </button>
    </form>
  );
}
