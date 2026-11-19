"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Pencil, Power, Trash2 } from "lucide-react";
import { deleteEmployeeAction, setEmployeeStatusAction } from "@/lib/employees";
import type { EmployeeStatus } from "@/lib/employee-shared";

type Props = {
  employeeId: string;
  employeeName: string;
  status: EmployeeStatus;
  /** False when the signed-in staff member is looking at their own record. */
  canModify: boolean;
  /** Only an administrator may permanently delete an employee. */
  canDelete: boolean;
};

export default function EmployeeAdminActions({ employeeId, employeeName, status, canModify, canDelete }: Props) {
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const activating = status === "inactive";

  return (
    <section className="card mt-4">
      <p className="section-title">Manage employee</p>

      {!canModify ? (
        <p className="mt-3 text-xs text-slate-500">
          This is your own account, so it cannot be deactivated or deleted here.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={`/boss/employees/${employeeId}/edit`} className="btn btn-ghost btn-sm">
            <Pencil className="h-3.5 w-3.5" /> Edit details
          </Link>

          <form action={setEmployeeStatusAction}>
            <input type="hidden" name="employee_id" value={employeeId} />
            <input type="hidden" name="status" value={activating ? "active" : "inactive"} />
            <button type="submit" className={`btn btn-sm ${activating ? "btn-success" : "btn-ghost"}`}>
              <Power className="h-3.5 w-3.5" />
              {activating ? "Reactivate account" : "Deactivate account"}
            </button>
          </form>

          {canDelete && (
            <button
              type="button"
              onClick={() => setShowDelete((value) => !value)}
              className="btn btn-sm btn-danger"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete permanently
            </button>
          )}
        </div>
      )}

      {canModify && canDelete && showDelete && (
        <form
          action={deleteEmployeeAction}
          className="mt-3 space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5"
        >
          <input type="hidden" name="employee_id" value={employeeId} />
          <p className="flex items-start gap-2 text-xs font-medium text-rose-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            This permanently removes <strong>{employeeName}</strong>, their login and their attendance/leave history.
            This cannot be undone. Prefer <em>Deactivate</em> to keep the history.
          </p>
          <div>
            <label className="label" htmlFor="confirm">
              Type DELETE to confirm
            </label>
            <input
              id="confirm"
              name="confirm"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              className="input"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={confirmText.trim().toUpperCase() !== "DELETE"}
              className="btn btn-sm btn-danger"
            >
              <Trash2 className="h-3.5 w-3.5" /> Permanently delete
            </button>
            <button type="button" onClick={() => setShowDelete(false)} className="btn btn-sm btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
