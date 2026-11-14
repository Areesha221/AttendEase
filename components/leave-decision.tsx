import { Check, X } from "lucide-react";
import { decideLeaveAction } from "@/lib/leave-approvals";

/** Approve / reject control for one pending leave request. */
export default function LeaveDecision({ leaveId, withNote = true }: { leaveId: string; withNote?: boolean }) {
  return (
    <form action={decideLeaveAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="leave_id" value={leaveId} />
      {withNote && (
        <input
          name="comment"
          placeholder="Optional note…"
          className="input w-40 px-3 py-1.5 text-xs"
          autoComplete="off"
        />
      )}
      <button type="submit" name="decision" value="approve" className="btn btn-sm btn-success">
        <Check className="h-3.5 w-3.5" /> Approve
      </button>
      <button type="submit" name="decision" value="reject" className="btn btn-sm btn-danger">
        <X className="h-3.5 w-3.5" /> Reject
      </button>
    </form>
  );
}
