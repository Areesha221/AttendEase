"use client";

import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import PasswordInput from "@/components/password-input";
import { changeOwnPasswordAction } from "@/lib/employees";
import { MIN_PASSWORD_LENGTH, type PasswordFormState } from "@/lib/employee-shared";

/** Employee self-service password change (My Profile). */
export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordFormState, FormData>(
    changeOwnPasswordAction,
    undefined,
  );

  return (
    <form action={formAction} className="card space-y-3">
      <p className="section-title flex items-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5" /> Change password
      </p>

      <div>
        <label className="label" htmlFor="current_password">
          Current password
        </label>
        <PasswordInput
          id="current_password"
          name="current_password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="new_password">
            New password
          </label>
          <PasswordInput
            id="new_password"
            name="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="confirm_password">
            Confirm new password
          </label>
          <PasswordInput
            id="confirm_password"
            name="confirm"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            placeholder="Repeat the new password"
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

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
