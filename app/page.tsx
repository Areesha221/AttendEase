import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CalendarCheck,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getSession } from "@/lib/session";

const FEATURES = [
  {
    icon: Camera,
    title: "Selfie check-in / check-out",
    body: "Every attendance event stores a live selfie, server time in Asia/Karachi, GPS coordinates and distance from the office.",
  },
  {
    icon: MapPin,
    title: "Location verification",
    body: "Configurable office radius (e.g. 100 m) with accuracy and inside/outside status for manager review.",
  },
  {
    icon: CalendarCheck,
    title: "Leave & payroll clarity",
    body: "Leave requests, balances, late/absence deductions and bonuses — all calculated transparently.",
  },
  {
    icon: Users,
    title: "Boss dashboard",
    body: "Live attendance, employee directory, photo review, leave approvals, reports and policy settings.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    body: "Role-based access, hashed passwords, masked CNIC, audit log for every correction and consent capture.",
  },
  {
    icon: GraduationCap,
    title: "Study-abroad guidance",
    body: "Explore countries, universities, programs, deadlines and requirements with profile-based suggestions.",
  },
];

export default async function WelcomePage() {
  const session = await getSession();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:py-16">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-black text-white shadow-md">
            AE
          </span>
          <div>
            <p className="text-lg font-bold text-slate-900">AttendEase</p>
            <p className="text-xs text-slate-500">Attendance &amp; Workforce Management</p>
          </div>
        </div>
        <Link href="/login" className="btn btn-ghost btn-sm">
          Sign in
        </Link>
      </header>

      <section className="mt-10 grid gap-10 lg:mt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <span className="badge bg-indigo-50 text-indigo-700 ring-indigo-200">
            Employee attendance • Leave • Payroll • Study abroad
          </span>
          <h1 className="mt-4 text-3xl leading-tight font-black text-slate-900 sm:text-5xl">
            Attendance you can trust,
            <span className="block text-indigo-600">management you can see.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-600">
            Employees register, check in and check out with a live selfie and verified location.
            Managers get real-time attendance, leave approvals, transparent deduction and bonus
            calculations, exportable reports — plus a study-abroad guidance module.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            {session ? (
              <Link
                href={session.role === "boss" ? "/boss" : "/app"}
                className="btn btn-primary"
              >
                Continue as {session.name} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link href="/login?role=employee" className="btn btn-primary">
                  Employee login <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login?role=boss" className="btn btn-ghost">
                  Boss / Administrator login
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card">
              <feature.icon className="h-5 w-5 text-indigo-600" />
              <p className="mt-3 text-sm font-bold text-slate-900">{feature.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-14 border-t border-slate-200 pt-5 text-xs text-slate-500">
        Server time is always recorded in Asia/Karachi (PKT). CNIC numbers are masked in the UI,
        photographs are stored privately, and every manual correction is written to the audit log.
      </footer>
    </main>
  );
}
