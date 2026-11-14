import { Check, X } from "lucide-react";
import { decideAttendanceReviewAction } from "@/lib/attendance-review";

/** Approve / reject control for one flagged attendance event. */
export default function AttendanceReview({ eventId }: { eventId: string }) {
  return (
    <form action={decideAttendanceReviewAction} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="event_id" value={eventId} />
      <input
        name="note"
        placeholder="Optional note…"
        className="input w-36 px-2.5 py-1 text-[11px]"
        autoComplete="off"
      />
      <button type="submit" name="decision" value="approve" className="btn btn-sm btn-success">
        <Check className="h-3.5 w-3.5" /> Approve
      </button>
      <button type="submit" name="decision" value="reject" className="btn btn-sm btn-danger">
        <X className="h-3.5 w-3.5" /> Reject
      </button>
    </form>
  );
}
