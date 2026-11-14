import Link from "next/link";
import { ArrowUpRight, CalendarClock, Clock3, Languages, Wallet } from "lucide-react";
import SaveProgramButton from "@/components/save-program-button";
import { formatTuition, parseRequirements, type ProgramRow, type SuggestionMatch } from "@/lib/careers";
import { daysUntil, formatDateHuman } from "@/lib/time";

function deadlineTone(daysLeft: number | null) {
  if (daysLeft === null) return { cls: "bg-slate-100 text-slate-600 ring-slate-200", text: "Rolling intake" };
  if (daysLeft < 0) return { cls: "bg-rose-50 text-rose-700 ring-rose-200", text: "Deadline passed" };
  if (daysLeft <= 30) return { cls: "bg-amber-50 text-amber-700 ring-amber-200", text: `${daysLeft} days left` };
  if (daysLeft <= 90) return { cls: "bg-sky-50 text-sky-700 ring-sky-200", text: `${daysLeft} days left` };
  return { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", text: `${daysLeft} days left` };
}

const MATCH_TONE: Record<SuggestionMatch, string> = {
  "Excellent match": "bg-emerald-600 text-white ring-emerald-600",
  "Good match": "bg-teal-600 text-white ring-teal-600",
  "Possible match": "bg-sky-600 text-white ring-sky-600",
  Stretch: "bg-slate-500 text-white ring-slate-500",
};

export default function ProgramCard({
  program,
  saved,
  revalidate,
  score,
  match,
  reasons,
  gaps,
}: {
  program: ProgramRow;
  saved: boolean;
  revalidate?: string;
  score?: number;
  match?: SuggestionMatch;
  reasons?: string[];
  gaps?: string[];
}) {
  const left = daysUntil(program.deadline);
  const tone = deadlineTone(left);
  const requirements = parseRequirements(program.requirements);

  return (
    <article className="card flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>
          {program.country_flag ?? "🎓"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-500">
            {program.university_name}
            {program.university_city ? ` • ${program.university_city}` : ""}
          </p>
          <h3 className="text-base font-bold text-slate-900">
            <Link href={`/careers/programs/${program.id}`} className="hover:text-teal-700">
              {program.name}
            </Link>
          </h3>
        </div>
        <SaveProgramButton programId={program.id} saved={saved} revalidate={revalidate} compact />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="badge bg-slate-100 text-slate-700 ring-slate-200">{program.level}</span>
        <span className="badge bg-indigo-50 text-indigo-700 ring-indigo-200">{program.discipline}</span>
        <span className="badge bg-slate-100 text-slate-600 ring-slate-200">{program.country_name}</span>
        {match ? <span className={`badge ${MATCH_TONE[match]}`}>{score}% · {match}</span> : null}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-2.5">
          <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Wallet className="h-3 w-3" /> Tuition / yr
          </p>
          <p className="mt-0.5 font-semibold text-slate-900">
            {formatTuition(program.tuition_per_year, program.currency)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5">
          <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Clock3 className="h-3 w-3" /> Duration
          </p>
          <p className="mt-0.5 font-semibold text-slate-900">{program.duration_months} months</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5">
          <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Languages className="h-3 w-3" /> IELTS
          </p>
          <p className="mt-0.5 font-semibold text-slate-900">{program.ielts_min ?? "Not required"}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5">
          <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <CalendarClock className="h-3 w-3" /> Intake
          </p>
          <p className="mt-0.5 font-semibold text-slate-900">{program.intake ?? "—"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`badge ${tone.cls}`}>
          {tone.text} · {formatDateHuman(program.deadline)}
        </span>
        {program.scholarship_note ? (
          <span className="badge bg-amber-50 text-amber-700 ring-amber-200">🎓 {program.scholarship_note}</span>
        ) : null}
      </div>

      {reasons && reasons.length > 0 ? (
        <ul className="space-y-1 text-xs text-emerald-700">
          {reasons.slice(0, 3).map((reason) => (
            <li key={reason}>✓ {reason}</li>
          ))}
        </ul>
      ) : null}

      {gaps && gaps.length > 0 ? (
        <ul className="space-y-1 text-xs text-slate-500">
          {gaps.slice(0, 2).map((gap) => (
            <li key={gap}>• {gap}</li>
          ))}
        </ul>
      ) : null}

      {requirements.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-slate-500">
            Required documents ({requirements.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {requirements.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-[11px] text-slate-400">
          {program.world_rank ? `Rank: ${program.world_rank}` : "Demo data"}
        </span>
        <Link
          href={`/careers/programs/${program.id}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-800"
        >
          View details <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
