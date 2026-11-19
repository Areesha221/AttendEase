import Link from "next/link";
import { requireSession } from "@/lib/session";
import CareersNav from "@/components/careers-nav";
import SignOutForm from "@/components/sign-out-form";

export default async function CareersLayout({ children }: LayoutProps<"/careers">) {
  const session = await requireSession();
  const home = session.role === "employee" ? "/app" : "/boss";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 pt-3">
          <Link
            href="/careers"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-sm font-black text-white"
          >
            AE
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">AttendEase Careers</p>
            <p className="truncate text-[11px] text-slate-500">
              {session.name} • Study-abroad guidance
            </p>
          </div>
          <Link
            href={home}
            className="hidden rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:inline-block"
          >
            Back to app
          </Link>
          <SignOutForm compact />
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pb-2">
          <CareersNav />
        </div>
      </header>

      <div className="flex-1">{children}</div>
    </>
  );
}
