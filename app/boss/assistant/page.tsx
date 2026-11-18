import { Sparkles } from "lucide-react";
import AssistantChat from "@/components/assistant-chat";
import { buildSuggestions } from "@/lib/assistant";
import { listTeamEmployees } from "@/lib/queries";
import { requireBoss } from "@/lib/session";

export const metadata = { title: "Assistant — AttendEase" };

export default async function AssistantPage() {
  await requireBoss();
  const employees = await listTeamEmployees();

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-black text-slate-900">Ask AttendEase</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Ask a normal English question about attendance, leave or payroll. Answers come straight from your
            own database — read-only, no external AI service, and every answer is repeatable.
          </p>
        </div>
      </div>

      <AssistantChat initialSuggestions={buildSuggestions(employees)} />
    </main>
  );
}
