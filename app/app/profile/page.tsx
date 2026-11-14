import Link from "next/link";
import { ArrowLeft, BadgeCheck, Building2, CalendarDays, Mail, Phone, ShieldCheck, Wallet } from "lucide-react";
import Avatar from "@/components/avatar";
import ChangePasswordForm from "@/components/change-password-form";
import { getEmployeeByUserId, getLeaveBalance, getSettings, getUserById } from "@/lib/queries";
import { formatPkr } from "@/lib/rules";
import { formatDateHuman, maskCnic, toWorkDate } from "@/lib/time";
import { requireEmployee } from "@/lib/session";

export default async function ProfilePage() {
  const session = await requireEmployee();
  const employee = getEmployeeByUserId(session.userId);

  if (!employee) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <div className="card">No employee profile linked to this account.</div>
      </main>
    );
  }

  const settings = getSettings();
  const balance = getLeaveBalance(employee.id);
  const user = getUserById(session.userId);

  const rows = [
    { label: "Employee code", value: employee.employee_code, mono: true },
    { label: "CNIC", value: maskCnic(employee.cnic), mono: true },
    { label: "Department", value: employee.department ?? "—" },
    { label: "Job title", value: employee.job_title ?? "—" },
    { label: "Joining date", value: formatDateHuman(employee.joining_date) },
    { label: "Status", value: employee.status === "active" ? "Active" : "Inactive" },
    { label: "Monthly salary", value: formatPkr(employee.monthly_salary) },
    { label: "Annual leave allowance", value: `${employee.annual_leave_allowance} days (+${employee.carry_forward_leave} carried)` },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6">
      <Link
        href="/app"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <header className="card flex flex-wrap items-center gap-4">
        <Avatar src={employee.photo} name={employee.full_name} size={72} />
        <div className="min-w-48 flex-1">
          <h1 className="text-xl font-black text-slate-900">{employee.full_name}</h1>
          <p className="text-sm text-slate-600">
            {employee.job_title} • {employee.department}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> {user?.email ?? "—"}
            </span>
            {employee.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {employee.phone}
              </span>
            )}
          </p>
        </div>
      </header>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <p className="section-title flex items-center gap-2">
            <BadgeCheck className="h-3.5 w-3.5" /> Employment details
          </p>
          <dl className="mt-3 divide-y divide-slate-100">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2.5 text-sm">
                <dt className="text-slate-500">{row.label}</dt>
                <dd className={`font-semibold text-slate-900 ${row.mono ? "font-mono text-xs" : ""}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-4">
          <div className="card">
            <p className="section-title flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5" /> Leave summary {toWorkDate().slice(0, 4)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-lg font-bold text-emerald-700">{balance.annualRemaining}</p>
                <p className="text-[11px] text-emerald-700/80">annual days left</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-lg font-bold text-slate-900">{balance.annualUsed}</p>
                <p className="text-[11px] text-slate-500">annual days used</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-lg font-bold text-slate-900">{balance.sickUsed}</p>
                <p className="text-[11px] text-slate-500">sick days used</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-lg font-bold text-slate-900">{balance.casualUsed}</p>
                <p className="text-[11px] text-slate-500">casual days used</p>
              </div>
            </div>
          </div>

          <div className="card">
            <p className="section-title flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" /> Office &amp; policy
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Office</dt>
                <dd className="font-semibold text-slate-900">{settings.office_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Working hours</dt>
                <dd className="font-semibold text-slate-900">
                  {settings.work_start} – {settings.work_end} ({settings.grace_minutes} min grace)
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Geo-fence radius</dt>
                <dd className="font-semibold text-slate-900">{settings.radius_m} m</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Late penalty</dt>
                <dd className="font-semibold text-slate-900">Rs. {settings.late_penalty} per late day</dd>
              </div>
              <div className="flex justify-between">
                <dt className="flex items-center gap-1.5 text-slate-500">
                  <Wallet className="h-3.5 w-3.5" /> Working days / month
                </dt>
                <dd className="font-semibold text-slate-900">{settings.work_days_per_month}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <p className="section-title flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> Consent
            </p>
            <p className="mt-3 text-sm text-slate-600">
              {employee.consent
                ? `Consent on file${employee.consent_at ? ` (recorded ${formatDateHuman(employee.consent_at.slice(0, 10))})` : ""} for photo, location, CNIC and attendance storage.`
                : "Consent has not been recorded yet. Please contact your administrator."}
            </p>
          </div>

          <ChangePasswordForm />
        </div>
      </section>
    </main>
  );
}
