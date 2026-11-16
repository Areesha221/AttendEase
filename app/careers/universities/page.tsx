import Link from "next/link";
import { ExternalLink, MapPin, Trophy } from "lucide-react";
import { listCountries, listUniversities } from "@/lib/careers";
import { requireSession } from "@/lib/session";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function UniversitiesPage({ searchParams }: PageProps<"/careers/universities">) {
  await requireSession();
  const params = await searchParams;
  const countryId = first(params.country);

  const countries = await listCountries();
  const universities = await listUniversities({ countryId });

  const grouped = countries
    .map((country) => ({
      country,
      list: universities.filter((university) => university.country_id === country.id),
    }))
    .filter((group) => group.list.length > 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <header>
        <h1 className="text-2xl font-black text-slate-900">Universities</h1>
        <p className="mt-1 text-sm text-slate-500">
          {universities.length} universities across {grouped.length} countries. Open a university to see every program,
          deadline and requirement.
        </p>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/careers/universities" className={`badge ring-slate-200 ${countryId ? "bg-white text-slate-600" : "bg-teal-600 text-white"}`}>
          All
        </Link>
        {countries.map((country) => (
          <Link
            key={country.id}
            href={`/careers/universities?country=${country.id}`}
            className={`badge ring-slate-200 ${
              countryId === country.id ? "bg-teal-600 text-white" : "bg-white text-slate-600"
            }`}
          >
            {country.flag} {country.name}
          </Link>
        ))}
      </div>

      <div className="mt-5 space-y-6">
        {grouped.map((group) => (
          <section key={group.country.id}>
            <h2 className="section-title">
              {group.country.flag} {group.country.name}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.list.map((university) => (
                <Link
                  key={university.id}
                  href={`/careers/universities/${university.id}`}
                  className="card-tight transition hover:border-teal-300 hover:shadow"
                >
                  <p className="font-bold text-slate-900">{university.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {university.city ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {university.city}
                      </span>
                    ) : null}
                    {university.world_rank ? (
                      <span className="inline-flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> {university.world_rank}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    {university.currency} {university.tuition_min?.toLocaleString()}–
                    {university.tuition_max?.toLocaleString()} / yr
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="badge bg-slate-100 text-slate-600 ring-slate-200">
                      {university.program_count} program{university.program_count === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-teal-700">
                      View <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
