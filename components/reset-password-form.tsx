"use client";

import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import PasswordInput from "@/components/password-input";
import { resetEmployeePasswordAction } from "@/lib/employees";
import { MIN_PASSWORD_LENGTH, type PasswordFormState } from "@/lib/employee-shared";

/** Boss-side password reset for one employee. */
export default function ResetPasswordForm({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [state, formAction, pending] = useActionState<PasswordFormState, FormData>(
    resetEmployeePasswordAction,
    undefined,
  );

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="employee_id" value={employeeId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="reset-password">
            New password
          </label>
          <PasswordInput
            id="reset-password"
            name="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="reset-confirm">
            Confirm password
          </label>
          <PasswordInput
            id="reset-confirm"
            name="confirm"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            placeholder="Repeat the password"
            className="input"
          />
        </div>
      </div>

      {state?.error && (
        <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.success}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-ghost btn-sm">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
        {pending ? "Updating…" : `Reset ${employeeName.split(" ")[0]}'s password`}
      </button>
    </form>
  );
}
