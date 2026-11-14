import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import EmployeeForm from "@/components/employee-form";
import { listDepartments, nextEmployeeCode } from "@/lib/queries";
import { requireBoss } from "@/lib/session";
import { toWorkDate } from "@/lib/time";

export const metadata = { title: "Add employee — AttendEase" };

export default async function NewEmployeePage() {
  await requireBoss();

  const departments = listDepartments();
  const suggestedCode = nextEmployeeCode();

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-6">
      <Link
        href="/boss/employees"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to employees
      </Link>

      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <UserPlus className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-black text-slate-900">Add employee</h1>
          <p className="text-sm text-slate-600">
            Creates the employee record and a login account they can sign in with.
          </p>
        </div>
      </header>

      <EmployeeForm
        mode="create"
        departments={departments}
        suggestedCode={suggestedCode}
        defaultJoiningDate={toWorkDate()}
      />
    </main>
  );
}
