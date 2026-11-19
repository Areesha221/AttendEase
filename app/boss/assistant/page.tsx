import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AssistantChat from "@/components/assistant-chat";
import { buildSuggestions } from "@/lib/assistant";
import { listTeamEmployees } from "@/lib/queries";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "Attendance Q&A — AttendEase" };

export default async function AssistantPage() {
  await requireStaff();
  const employees = await listTeamEmployees();

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-6">
      <Link
        href="/boss"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <h1 className="text-xl font-black text-slate-900">Attendance Q&amp;A</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Ask a normal English question about attendance, leave, payroll or office policy. Answers are built
        from the same records as the dashboard, by fixed rules — read-only, repeatable and auditable.
      </p>

      <AssistantChat initialSuggestions={buildSuggestions(employees)} />
    </main>
  );
}
