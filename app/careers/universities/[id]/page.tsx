import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Globe, MapPin, Trophy, Wallet } from "lucide-react";
import ProgramCard from "@/components/program-card";
import { getUniversity, listPrograms, listSavedProgramIds } from "@/lib/careers";
import { requireSession } from "@/lib/session";

export default async function UniversityDetailPage({ params }: PageProps<"/careers/universities/[id]">) {
  const session = await requireSession();
  const { id } = await params;

  const university = getUniversity(id);
  if (!university) notFound();

  const programs = listPrograms({ universityId: id, limit: 100 });
  const savedIds = new Set(listSavedProgramIds(session.userId));

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <Link
        href="/careers/universities"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> All universities
      </Link>

      <header className="card">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none" aria-hidden>
            {university.country_flag ?? "🎓"}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black text-slate-900">{university.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {university.city ?? university.country_name}
              </span>
              {university.world_rank ? (
                <span className="inline-flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5" /> {university.world_rank}
                </span>
              ) : null}
              {university.website ? (
                <a
                  href={university.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-800"
                >
                  <Globe className="h-3.5 w-3.5" /> Official site <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <Wallet className="h-3 w-3" /> Tuition range
            </p>
            <p className="mt-0.5 font-semibold text-slate-900">
              {university.currency} {university.tuition_min?.toLocaleString()}–{university.tuition_max?.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-medium text-slate-500">Country</p>
            <p className="mt-0.5 font-semibold text-slate-900">
              {university.country_flag} {university.country_name}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-medium text-slate-500">Programs listed</p>
            <p className="mt-0.5 font-semibold text-slate-900">{university.program_count}</p>
          </div>
        </div>

        {university.scholarship ? (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">🎓 {university.scholarship}</p>
        ) : null}
      </header>

      <h2 className="section-title mt-6">Programs &amp; deadlines</h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {programs.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            saved={savedIds.has(program.id)}
            revalidate={`/careers/universities/${id}`}
          />
        ))}
      </div>
    </main>
  );
}
