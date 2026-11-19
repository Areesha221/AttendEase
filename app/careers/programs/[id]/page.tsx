import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Globe,
  Languages,
  MapPin,
  Trophy,
  Wallet,
} from "lucide-react";
import SaveProgramButton from "@/components/save-program-button";
import { formatTuition, getProgram, isProgramSaved, parseRequirements } from "@/lib/careers";
import { daysUntil, formatDateHuman } from "@/lib/time";
import { requireSession } from "@/lib/session";

export default async function ProgramDetailPage({ params }: PageProps<"/careers/programs/[id]">) {
  const session = await requireSession();
  const { id } = await params;

  const program = await getProgram(id);
  if (!program) notFound();

  const saved = await isProgramSaved(session.userId, program.id);
  const requirements = parseRequirements(program.requirements);
  const left = daysUntil(program.deadline);
  const deadlineText =
    left === null
      ? "Rolling / check website"
      : left < 0
        ? `Closed (was ${formatDateHuman(program.deadline)})`
        : `${formatDateHuman(program.deadline)} · ${left} days left`;

  const facts = [
    { icon: Wallet, label: "Tuition / year", value: formatTuition(program.tuition_per_year, program.currency) },
    { icon: Clock3, label: "Duration", value: `${program.duration_months} months` },
    { icon: Languages, label: "IELTS minimum", value: program.ielts_min === null ? "Not required" : String(program.ielts_min) },
    {
      icon: Trophy,
      label: "Grade minimum",
      value:
        [
          program.min_gpa !== null ? `CGPA ${program.min_gpa}` : null,
          program.min_percentage !== null ? `${program.min_percentage}%` : null,
        ]
          .filter(Boolean)
          .join(" / ") || "No strict cut-off",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6">
      <Link
        href={`/careers/universities/${program.university_id}`}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> {program.university_name}
      </Link>

      <header className="card">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none" aria-hidden>
            {program.country_flag ?? "🎓"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge bg-slate-100 text-slate-700 ring-slate-200">{program.level}</span>
              <span className="badge bg-blue-50 text-blue-950 ring-blue-200">{program.discipline}</span>
              <span className="badge bg-slate-100 text-slate-600 ring-slate-200">
                {program.country_flag} {program.country_name}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">{program.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> {program.university_name}
              </span>
              {program.university_city ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {program.university_city}
                </span>
              ) : null}
              {program.world_rank ? (
                <span className="inline-flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5" /> {program.world_rank}
                </span>
              ) : null}
            </p>
          </div>
          <SaveProgramButton programId={program.id} saved={saved} revalidate={`/careers/programs/${program.id}`} />
        </div>

        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="badge bg-amber-50 text-amber-700 ring-amber-200">
            <CalendarClock className="h-3.5 w-3.5" /> {program.intake ?? "Intake TBC"}
          </span>
          <span
            className={`badge ${
              left !== null && left < 0
                ? "bg-rose-50 text-rose-700 ring-rose-200"
                : "bg-emerald-50 text-emerald-700 ring-emerald-200"
            }`}
          >
            Deadline: {deadlineText}
          </span>
        </p>
      </header>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <p className="section-title flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" /> Required documents &amp; entry requirements
          </p>
          {requirements.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {requirements.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">See the university website for the current checklist.</p>
          )}

          {program.scholarship_note ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">🎓 {program.scholarship_note}</p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="card">
            <p className="section-title">Key facts</p>
            <dl className="mt-3 space-y-3">
              {facts.map((fact) => {
                const Icon = fact.icon;
                return (
                  <div key={fact.label} className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <dt className="text-[11px] font-medium text-slate-500">{fact.label}</dt>
                      <dd className="text-sm font-semibold text-slate-900">{fact.value}</dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          </div>

          <div className="card">
            <p className="section-title">Source &amp; next step</p>
            <p className="mt-2 text-xs text-slate-500">
              Figures are demo data for a college project. Always confirm on the official page before applying.
            </p>
            <div className="mt-3 space-y-2">
              {program.source_url ? (
                <a
                  href={program.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost w-full text-xs"
                >
                  <Globe className="h-3.5 w-3.5" /> Program page <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              {program.website ? (
                <a href={program.website} target="_blank" rel="noreferrer" className="btn btn-ghost w-full text-xs">
                  <Building2 className="h-3.5 w-3.5" /> University site <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
