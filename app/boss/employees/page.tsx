import Link from "next/link";
import { ChevronRight, Search, UserPlus, Users } from "lucide-react";
import Avatar from "@/components/avatar";
import StatusBadge from "@/components/status-badge";
import { getEmployeeDirectory, listDepartments } from "@/lib/queries";
import { getEmployeeAccountRole } from "@/lib/employees";
import { formatPkr } from "@/lib/rules";
import { formatStamp12 } from "@/lib/time";
import { requireHr } from "@/lib/session";

export default async function EmployeesPage(props: PageProps<"/boss/employees">) {
  const session = await requireHr();

  const params = await props.searchParams;
  const search = typeof params.search === "string" ? params.search : "";
  const department = typeof params.department === "string" ? params.department : "all";
  const includeInactive = params.inactive === "1";
  const departments = await listDepartments();
  const rows = await getEmployeeDirectory({ search: search || undefined, department, includeInactive });
  const staffRoles = new Map(
    await Promise.all(rows.map(async (row) => [row.id, await getEmployeeAccountRole(row.id)] as const)),
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Employees</h1>
          <p className="mt-1 text-sm text-slate-600">
            {rows.length} employee(s) • live status, monthly attendance and salary
          </p>
        </div>
        <Link href="/boss/employees/new" className="btn btn-primary">
          <UserPlus className="h-4 w-4" /> Add employee
        </Link>
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-3" action="/boss/employees">
        <div className="min-w-[14rem] flex-1">
          <label className="label" htmlFor="search">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="search"
              name="search"
              defaultValue={search}
              placeholder="Name, code, phone, CNIC or department…"
              className="input pl-9"
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="department">
            Department
          </label>
          <select id="department" name="department" defaultValue={department} className="input min-w-[10rem]">
            <option value="all">All departments</option>
            {departments.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            name="inactive"
            value="1"
            defaultChecked={includeInactive}
            className="h-4 w-4 rounded border-slate-300"
          />
          Show inactive
        </label>
        <button type="submit" className="btn btn-primary">
          Apply filters
        </button>
        {(search || department !== "all" || includeInactive) && (
          <Link href="/boss/employees" className="btn btn-ghost">
            Clear
          </Link>
        )}
      </form>

      <section className="mt-5 card">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <p className="section-title">Directory</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] tracking-wide text-slate-500 uppercase">
                <th className="py-2 pr-3 font-semibold">Employee</th>
                <th className="py-2 pr-3 font-semibold">Department</th>
                <th className="py-2 pr-3 font-semibold">Today</th>
                <th className="py-2 pr-3 font-semibold">Check-in / out</th>
                <th className="py-2 pr-3 font-semibold">Late / Absent</th>
                <th className="py-2 pr-3 font-semibold">Salary</th>
                <th className="py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((employee) => (
                <tr key={employee.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={employee.photo} name={employee.full_name} size={38} />
                      <div>
                        <p className="font-semibold text-slate-800">
                          {employee.full_name}
                          {staffRoles.get(employee.id) && (
                            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 align-middle text-[10px] font-semibold text-blue-900 ring-1 ring-blue-200">
                              {staffRoles.get(employee.id) === "admin" ? "Owner" : "Staff"}
                            </span>
                          )}
                          {employee.status === "inactive" && (
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
                              Inactive
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {employee.employee_code} • {employee.job_title ?? "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-slate-700">{employee.department ?? "—"}</td>
                  <td className="py-3 pr-3">
                    <StatusBadge status={employee.todayStatus} />
                  </td>
                  <td className="py-3 pr-3 text-slate-700">
                    {formatStamp12(employee.lastCheckIn)} / {formatStamp12(employee.lastCheckOut)}
                  </td>
                  <td className="py-3 pr-3 text-slate-700">
                    <span className="text-amber-600">{employee.lateDaysThisMonth}</span> /{" "}
                    <span className="text-rose-600">{employee.absentDaysThisMonth}</span>
                  </td>
                  <td className="py-3 pr-3 text-slate-700">
                    {session.role === "admin" || !staffRoles.get(employee.id)
                      ? formatPkr(employee.monthly_salary)
                      : "—"}
                  </td>
                  <td className="py-3">
                    <Link
                      href={`/boss/employees/${employee.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-900 hover:text-blue-950"
                    >
                      View <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                    No employees match those filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
