import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LoginForm from "./login-form";

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const roleParam = Array.isArray(params.role) ? params.role[0] : params.role;
  const initialRole = roleParam === "boss" ? "boss" : "employee";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-6 inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to welcome
      </Link>

      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-black text-white shadow-md">
            AE
          </span>
          <h1 className="mt-4 text-2xl font-black text-slate-900 sm:text-3xl">Sign in to AttendEase</h1>
          <p className="mt-2 text-sm text-slate-600">
            Employees check in with a selfie and verified location. Bosses manage attendance, leave
            and reports. Your role decides what you see.
          </p>

          <ul className="mt-5 space-y-2 text-sm text-slate-600">
            <li>• Server time is recorded in Asia/Karachi — device clock cannot be faked.</li>
            <li>• Offline attendance is queued and synced automatically.</li>
            <li>• Passwords are hashed; CNIC numbers are masked.</li>
          </ul>
        </div>

        <div className="flex justify-center lg:justify-start">
          <LoginForm initialRole={initialRole} />
        </div>
      </div>
    </main>
  );
}
