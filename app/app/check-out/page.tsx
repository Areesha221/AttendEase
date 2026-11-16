import Link from "next/link";
import { ArrowLeft, CheckCircle2, LogIn } from "lucide-react";
import SelfieCapture from "@/components/selfie-capture";
import { getEmployeeByUserId, getEventsForDate, getSettings } from "@/lib/queries";
import { formatTime12, toWorkDate } from "@/lib/time";
import { eventClock } from "@/lib/rules";
import { requireEmployee } from "@/lib/session";

export default async function CheckOutPage() {
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
  const workDate = toWorkDate();
  const events = await getEventsForDate(employee.id, workDate);
  const checkIn = events.find((event) => event.type === "check_in") ?? null;
  const checkOut = events.find((event) => event.type === "check_out") ?? null;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6">
      <Link
        href="/app"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <h1 className="text-xl font-black text-slate-900">Check out</h1>
      <p className="mt-1 text-sm text-slate-600">
        {settings.work_end} • {settings.office_name}
      </p>

      {!checkIn ? (
        <div className="card mt-5">
          <p className="text-sm font-semibold text-slate-900">You have not checked in yet today.</p>
          <p className="mt-2 text-sm text-slate-600">Check in first, then you can check out.</p>
          <div className="mt-4">
            <Link href="/app/check-in" className="btn btn-success">
              <LogIn className="h-4 w-4" /> Go to check-in
            </Link>
          </div>
        </div>
      ) : checkOut ? (
        <div className="card mt-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-5 w-5" /> You already checked out today at {formatTime12(eventClock(checkOut))}.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Checked in at {formatTime12(eventClock(checkIn))}. Your attendance for today is complete.
          </p>
          <div className="mt-4">
            <Link href="/app/attendance" className="btn btn-ghost">
              View attendance
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <p className="mb-3 text-sm text-slate-600">
            You checked in at {formatTime12(eventClock(checkIn))}. Capture a selfie to close the day.
          </p>
          <SelfieCapture
            type="check_out"
            office={{
              name: settings.office_name,
              lat: settings.office_lat,
              lng: settings.office_lng,
              radiusM: settings.radius_m,
            }}
            employeeName={employee.full_name}
            employeeCode={employee.employee_code}
          />
        </div>
      )}
    </main>
  );
}
