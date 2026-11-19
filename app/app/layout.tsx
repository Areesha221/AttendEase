import Link from "next/link";
import { requireEmployee } from "@/lib/session";
import EmployeeNav from "@/components/employee-nav";
import OfflineBanner from "@/components/offline-banner";
import SignOutForm from "@/components/sign-out-form";

export default async function EmployeeLayout({ children }: LayoutProps<"/app">) {
  const session = await requireEmployee();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 pt-3">
          <Link
            href="/app"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-900 text-sm font-black text-white"
          >
            AE
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">AttendEase</p>
            <p className="truncate text-[11px] text-slate-500">
              {session.name} • {session.department}
            </p>
          </div>
          <SignOutForm compact />
        </div>
        <div className="mx-auto w-full max-w-5xl px-4 pb-2">
          <EmployeeNav />
        </div>
      </header>

      <OfflineBanner />

      <div className="flex-1">{children}</div>
    </>
  );
}
