import Link from "next/link";
import { Bookmark, Compass } from "lucide-react";
import ProgramCard from "@/components/program-card";
import { listSavedPrograms } from "@/lib/careers";
import { daysUntil } from "@/lib/time";
import { requireSession } from "@/lib/session";

export default async function SavedProgramsPage() {
  const session = await requireSession();
  const programs = listSavedPrograms(session.userId);

  const closingSoon = programs.filter((program) => {
    const left = daysUntil(program.deadline);
    return left !== null && left >= 0 && left <= 45;
  }).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">My shortlist</h1>
          <p className="mt-1 text-sm text-slate-500">
            {programs.length} saved program{programs.length === 1 ? "" : "s"}
            {closingSoon > 0 ? ` · ${closingSoon} closing within 45 days` : ""}.
          </p>
        </div>
        <Link href="/careers" className="btn btn-ghost btn-sm">
          <Compass className="h-4 w-4" /> Discover more
        </Link>
      </header>

      {programs.length === 0 ? (
        <div className="card mt-5 flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Bookmark className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">Nothing saved yet</p>
          <p className="max-w-md text-xs text-slate-500">
            Tap the bookmark on any program to keep it here. Your shortlist is private to your account.
          </p>
          <Link href="/careers" className="btn btn-primary btn-sm mt-1">
            Browse programs
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} saved revalidate="/careers/saved" />
          ))}
        </div>
      )}
    </main>
  );
}
