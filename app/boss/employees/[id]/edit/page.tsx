import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import EmployeeForm from "@/components/employee-form";
import { getEmployeeById, getUserById, listDepartments } from "@/lib/queries";
import { requireBoss } from "@/lib/session";

export const metadata = { title: "Edit employee — AttendEase" };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requireBoss();

  const { id } = await params;
  const employee = getEmployeeById(id);
  if (!employee) notFound();

  const user = employee.user_id ? getUserById(employee.user_id) : undefined;
  const departments = listDepartments();

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-6">
      <Link
        href={`/boss/employees/${employee.id}`}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {employee.full_name}
      </Link>

      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <Pencil className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-black text-slate-900">Edit employee</h1>
          <p className="text-sm text-slate-600">
            Update {employee.full_name}&apos;s details, salary, status or login.
          </p>
        </div>
      </header>

      <EmployeeForm
        mode="edit"
        departments={departments}
        employee={{
          id: employee.id,
          fullName: employee.full_name,
          email: user?.email ?? "",
          employeeCode: employee.employee_code,
          cnic: employee.cnic ?? "",
          phone: employee.phone ?? "",
          department: employee.department ?? "",
          jobTitle: employee.job_title ?? "",
          joiningDate: employee.joining_date ?? "",
          monthlySalary: employee.monthly_salary,
          annualLeaveAllowance: employee.annual_leave_allowance,
          status: employee.status,
        }}
      />
    </main>
  );
}
