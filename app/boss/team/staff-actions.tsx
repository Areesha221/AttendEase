"use client";

import { useActionState, useState } from "react";
import { Check, KeyRound, Loader2, Power, X } from "lucide-react";
import {
  resetStaffPasswordAction,
  setStaffStatusAction,
  type StaffFormState,
} from "@/lib/staff-accounts";

type Props = {
  userId: string;
  email: string;
  isActive: boolean;
  isSelf: boolean;
};

export default function StaffActions({ userId, email, isActive, isSelf }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<StaffFormState, FormData>(
    resetStaffPasswordAction,
    undefined,
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <form action={setStaffStatusAction}>
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="is_active" value={isActive ? "0" : "1"} />
          <button
            type="submit"
            disabled={isSelf}
            className={`btn btn-sm ${isActive ? "btn-ghost" : "btn-success"}`}
            title={isSelf ? "You cannot deactivate your own account." : undefined}
          >
            <Power className="h-3.5 w-3.5" />
            {isActive ? "Deactivate" : "Activate"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="btn btn-sm btn-ghost"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Reset password
        </button>
      </div>

      {open && (
        <form action={formAction} className="flex w-full flex-col items-end gap-1.5 sm:max-w-xs">
          <input type="hidden" name="user_id" value={userId} />
          <label className="sr-only" htmlFor={`staff-password-${userId}`}>
            New password for {email}
          </label>
          <div className="flex w-full items-center gap-2">
            <input
              id={`staff-password-${userId}`}
              name="password"
              type="password"
              className="input py-1.5 text-xs"
              placeholder="New password"
              autoComplete="new-password"
              required
            />
            <button type="submit" disabled={pending} className="btn btn-primary btn-sm shrink-0">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </button>
          </div>
          {state?.fieldErrors?.password && (
            <p className="text-[11px] text-rose-700">{state.fieldErrors.password}</p>
          )}
          {state?.success && (
            <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
              <Check className="h-3 w-3" /> {state.success}
            </p>
          )}
          {state?.error && (
            <p className="flex items-center gap-1 text-[11px] text-rose-700">
              <X className="h-3 w-3" /> {state.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
