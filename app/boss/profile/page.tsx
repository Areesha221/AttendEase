import Link from "next/link";
import { ArrowLeft, Building2, Mail, ShieldCheck, UserCog } from "lucide-react";
import ChangePasswordForm from "@/components/change-password-form";
import { getSettings, getUserById } from "@/lib/queries";
import { requireBoss } from "@/lib/session";

export default async function BossProfilePage() {
  const session = await requireBoss();
  const user = getUserById(session.userId);
  const settings = getSettings();

  const rows = [
    { label: "Email", value: user?.email ?? "—", mono: true },
    { label: "Role", value: "Boss / Administrator" },
    { label: "Department", value: session.department || "Management" },
    { label: "Office", value: settings.office_name },
    {
      label: "Working hours",
      value: `${settings.work_start} – ${settings.work_end} (${settings.grace_minutes} min grace)`,
    },
    { label: "Geo-fence radius", value: `${settings.radius_m} m` },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6">
      <Link
        href="/boss"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <header className="card flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white">
          {session.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="min-w-48 flex-1">
          <h1 className="text-xl font-black text-slate-900">{session.name}</h1>
          <p className="text-sm text-slate-600">Boss / Administrator • {session.department}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Mail className="h-3.5 w-3.5" /> {user?.email ?? "—"}
          </p>
        </div>
      </header>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <p className="section-title flex items-center gap-2">
            <UserCog className="h-3.5 w-3.5" /> Account details
          </p>
          <dl className="mt-3 divide-y divide-slate-100">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2.5 text-sm">
                <dt className="text-slate-500">{row.label}</dt>
                <dd className={`font-semibold text-slate-900 ${row.mono ? "font-mono text-xs" : ""}`}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-4">
          <div className="card">
            <p className="section-title flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" /> Administrator access
            </p>
            <p className="mt-3 text-sm text-slate-600">
              This account can manage employees, approve leave, review attendance and change policy
              settings. You can change your own password below at any time — no one else can see it.
            </p>
          </div>

          <div className="card">
            <p className="section-title flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> Security
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Passwords are stored as bcrypt hashes. Use the eye icon in the password fields to reveal
              what you are typing.
            </p>
          </div>

          <ChangePasswordForm />
        </div>
      </section>
    </main>
  );
}
