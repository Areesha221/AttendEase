import AttendanceSuccess from "@/components/attendance-success";
import { requireEmployee } from "@/lib/session";

export default async function SuccessPage(props: PageProps<"/app/success">) {
  await requireEmployee();
  const params = await props.searchParams;

  return (
    <AttendanceSuccess
      params={params}
      homeHref="/app"
      checkOutHref="/app/check-out"
      attendanceHref="/app/attendance"
    />
  );
}
