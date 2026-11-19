import { redirect } from "next/navigation";
import { getEmployeeByUserId, getEventsForDate } from "@/lib/queries";
import { normalizeGateCode } from "@/lib/gate";
import { requireSession } from "@/lib/session";
import { toWorkDate } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Landing page for the entrance QR. A phone camera opens this URL with the
 * current code; we send the employee to check-in or check-out depending on
 * what they have already recorded today, keeping the code in the query string.
 */
export default async function GateEntryPage(props: PageProps<"/app/gate">) {
  const session = await requireSession();
  if (session.role !== "employee") redirect("/boss/gate");

  const employee = await getEmployeeByUserId(session.userId);
  if (!employee) redirect("/app");

  const params = await props.searchParams;
  const code = normalizeGateCode(typeof params.code === "string" ? params.code : "");
  const query = code ? `?code=${code}` : "";

  const events = (await getEventsForDate(employee.id, toWorkDate())).filter(
    (event) => event.review_status !== "rejected",
  );
  const checkedIn = events.some((event) => event.type === "check_in");
  const checkedOut = events.some((event) => event.type === "check_out");

  if (checkedIn && checkedOut) redirect("/app");
  redirect(checkedIn ? `/app/check-out${query}` : `/app/check-in${query}`);
}
