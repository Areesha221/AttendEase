import AttendanceSuccess from "@/components/attendance-success";
import { requireStaff } from "@/lib/session";

export default async function StaffAttendanceSuccessPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  const params = await props.searchParams;

  return (
    <AttendanceSuccess
      params={params}
      homeHref="/boss/me"
      checkOutHref="/boss/me"
      attendanceHref="/boss/me"
    />
  );
}
