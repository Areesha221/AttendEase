import Link from "next/link";
import { CalendarClock, GraduationCap, Search, Sparkles, X } from "lucide-react";
import ProgramCard from "@/components/program-card";
import {
  countPrograms,
  listCountries,
  listDisciplines,
  listLevels,
  listPrograms,
  listSavedProgramIds,
  listUpcomingDeadlines,
} from "@/lib/careers";
import { daysUntil, formatDateHuman } from "@/lib/time";
import { requireSession } from "@/lib/session";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function CareersDiscoverPage({ searchParams }: PageProps<"/careers">) {
  const session = await requireSession();
  const params = await searchParams;

  const search = first(params.search);
  const countryId = first(params.country);
  const level = first(params.level);
  const discipline = first(params.discipline);

  const countries = listCountries();
  const levels = listLevels();
  const disciplines = listDisciplines();
  const programs = listPrograms({ search, countryId, level, discipline, limit: 60 });
  const totalPrograms = countPrograms();
  const matchedPrograms = countPrograms({ search, countryId, level, discipline });
  const savedIds = new Set(listSavedProgramIds(session.userId));
  const deadlines = listUpcomingDeadlines(180, 6);

  const hasFilters = Boolean(search || countryId || level || discipline);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <section className="card bg-linear-to-br from-teal-600 to-emerald-600 text-white">
        <p className="text-xs font-semibold tracking-wider text-white/70 uppercase">Study abroad, guided</p>
        <h1 className="mt-1 text-2xl font-black">Find your university, deadline and documents in one place</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/85">
          {countries.length} countries · {totalPrograms} programs with intakes, deadlines, required documents and
          scholarships. Tell us about yourself and get ranked matches.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/careers/suggestions" className="btn bg-white text-teal-700 hover:bg-teal-50">
            <Sparkles className="h-4 w-4" /> Get my suggestions
          </Link>
          <Link href="/careers/universities" className="btn border border-white/40 text-white hover:bg-white/10">
            <GraduationCap className="h-4 w-4" /> Browse universities
          </Link>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="section-title">Countries &amp; quick facts</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {countries.map((country) => (
            <Link
              key={country.id}
              href={`/careers?country=${country.id}`}
              className={`card-tight transition hover:border-teal-300 hover:shadow ${
                countryId === country.id ? "border-teal-400 ring-1 ring-teal-200" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden>
                  {country.flag}
                </span>
                <p className="font-bold text-slate-900">{country.name}</p>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{country.intakes}</p>
              <p className="mt-2 text-xs text-slate-600">{country.summary}</p>
              <p className="mt-2 text-[11px] text-slate-400">
                Avg tuition {country.currency} {country.avg_tuition?.toLocaleString()} · living{" "}
                {country.currency} {country.living_cost?.toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {deadlines.length > 0 ? (
        <section className="mt-5">
          <h2 className="section-title flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5" /> Closing soon
          </h2>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {deadlines.map((program) => {
              const left = daysUntil(program.deadline);
              return (
                <Link
                  key={program.id}
                  href={`/careers/programs/${program.id}`}
                  className="card-tight w-64 shrink-0 transition hover:border-teal-300 hover:shadow"
                >
                  <p className="truncate text-xs font-semibold text-slate-500">{program.university_name}</p>
                  <p className="truncate text-sm font-bold text-slate-900">{program.name}</p>
                  <p className="mt-1 text-xs text-amber-700">
                    {formatDateHuman(program.deadline)} · {left} days left
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="section-title">All programs</h2>
          {hasFilters ? (
            <Link href="/careers" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
              <X className="h-3.5 w-3.5" /> Clear filters
            </Link>
          ) : null}
        </div>

        <form method="get" action="/careers" className="card-tight mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="label" htmlFor="search">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" />
              <input
                id="search"
                name="search"
                defaultValue={search}
                placeholder="Program, university, subject…"
                className="input pl-9"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="country">
              Country
            </label>
            <select id="country" name="country" defaultValue={countryId} className="input">
              <option value="">Any country</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="level">
              Level
            </label>
            <select id="level" name="level" defaultValue={level} className="input">
              <option value="">Any level</option>
              {levels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="discipline">
              Subject
            </label>
            <select id="discipline" name="discipline" defaultValue={discipline} className="input">
              <option value="">Any subject</option>
              {disciplines.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <button type="submit" className="btn btn-primary">
              <Search className="h-4 w-4" /> Apply filters
            </button>
          </div>
        </form>

        <p className="mt-4 text-sm text-slate-500">
          {matchedPrograms} program{matchedPrograms === 1 ? "" : "s"} found
          {matchedPrograms > programs.length ? ` · showing first ${programs.length}` : ""}
        </p>

        {programs.length === 0 ? (
          <div className="card mt-3 text-sm text-slate-600">
            No programs match these filters. Try clearing them or searching a different subject.
          </div>
        ) : (
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {programs.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                saved={savedIds.has(program.id)}
                revalidate="/careers"
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
