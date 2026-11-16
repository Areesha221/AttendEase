import Link from "next/link";
import { Info, Sparkles, Wand2, X } from "lucide-react";
import ProgramCard from "@/components/program-card";
import {
  listCountries,
  listDisciplines,
  listLevels,
  listSavedProgramIds,
  suggestPrograms,
  type StudentProfile,
} from "@/lib/careers";
import { requireSession } from "@/lib/session";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function num(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function SuggestionsPage({ searchParams }: PageProps<"/careers/suggestions">) {
  const session = await requireSession();
  const params = await searchParams;

  const profile: StudentProfile = {
    level: first(params.level) || undefined,
    discipline: first(params.discipline) || undefined,
    countryId: first(params.country) || undefined,
    budget: num(first(params.budget)),
    ielts: num(first(params.ielts)),
    gpa: num(first(params.gpa)),
    percentage: num(first(params.percentage)),
  };

  const hasProfile = Boolean(
    profile.level ||
      profile.discipline ||
      profile.countryId ||
      profile.budget ||
      profile.ielts !== undefined ||
      profile.gpa !== undefined ||
      profile.percentage !== undefined,
  );

  const suggestions = hasProfile ? await suggestPrograms(profile, 12) : [];
  const savedIds = new Set(await listSavedProgramIds(session.userId));

  const countries = await listCountries();
  const levels = await listLevels();
  const disciplines = await listDisciplines();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <header className="card bg-gradient-to-br from-indigo-600 to-teal-600 text-white">
        <p className="text-xs font-semibold tracking-wider text-white/70 uppercase">Profile-based guidance</p>
        <h1 className="mt-1 text-2xl font-black">Tell us about yourself, get ranked matches</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/85">
          We compare your grades, IELTS, budget and interests against every program&apos;s real requirements and show why
          each one fits — plus the gaps you need to close. Nothing is stored; it is calculated live.
        </p>
      </header>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <form method="get" action="/careers/suggestions" className="card space-y-3 lg:col-span-1">
          <p className="section-title flex items-center gap-2">
            <Wand2 className="h-3.5 w-3.5" /> Your profile
          </p>
          <div>
            <label className="label" htmlFor="level">
              Study level
            </label>
            <select id="level" name="level" defaultValue={profile.level ?? ""} className="input">
              <option value="">Any</option>
              {levels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="discipline">
              Subject you want
            </label>
            <select id="discipline" name="discipline" defaultValue={profile.discipline ?? ""} className="input">
              <option value="">Any</option>
              {disciplines.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="country">
              Preferred country
            </label>
            <select id="country" name="country" defaultValue={profile.countryId ?? ""} className="input">
              <option value="">Any</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="budget">
                Tuition budget / yr
              </label>
              <input
                id="budget"
                name="budget"
                type="number"
                min={0}
                step={500}
                defaultValue={profile.budget ?? ""}
                placeholder="e.g. 25000"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="ielts">
                IELTS
              </label>
              <input
                id="ielts"
                name="ielts"
                type="number"
                min={0}
                max={9}
                step={0.5}
                defaultValue={profile.ielts ?? ""}
                placeholder="e.g. 6.5"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="gpa">
                CGPA (4.0)
              </label>
              <input
                id="gpa"
                name="gpa"
                type="number"
                min={0}
                max={4}
                step={0.1}
                defaultValue={profile.gpa ?? ""}
                placeholder="e.g. 3.2"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="percentage">
                or %
              </label>
              <input
                id="percentage"
                name="percentage"
                type="number"
                min={0}
                max={100}
                step={1}
                defaultValue={profile.percentage ?? ""}
                placeholder="e.g. 65"
                className="input"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-full">
            <Sparkles className="h-4 w-4" /> Get suggestions
          </button>
          {hasProfile ? (
            <Link
              href="/careers/suggestions"
              className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              <X className="h-3.5 w-3.5" /> Reset
            </Link>
          ) : null}
        </form>

        <div className="lg:col-span-2">
          {!hasProfile ? (
            <div className="card flex h-full flex-col items-center justify-center gap-3 text-center">
              <Sparkles className="h-8 w-8 text-teal-500" />
              <p className="text-sm font-semibold text-slate-700">Fill the form to see your ranked matches</p>
              <p className="max-w-md text-xs text-slate-500">
                The more you fill in, the sharper the ranking. Even one field — like your IELTS score or budget — is
                enough to start.
              </p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="card text-sm text-slate-600">
              No programs matched this profile. Try widening your budget, country or subject.
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-teal-50 p-3 text-xs text-teal-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  <strong>{suggestions.length} matches</strong> ranked by how well they fit your profile. The score
                  combines subject, level, country, budget, IELTS and grades, and gives extra weight to soon-closing
                  deadlines.
                </p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <ProgramCard
                    key={suggestion.program.id}
                    program={suggestion.program}
                    saved={savedIds.has(suggestion.program.id)}
                    revalidate="/careers/suggestions"
                    score={suggestion.score}
                    match={suggestion.match}
                    reasons={suggestion.reasons}
                    gaps={suggestion.gaps}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
