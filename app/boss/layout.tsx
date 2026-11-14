import Link from "next/link";
import { requireBoss } from "@/lib/session";
import BossNav from "@/components/boss-nav";
import SignOutForm from "@/components/sign-out-form";

export default async function BossLayout({ children }: LayoutProps<"/boss">) {
  const session = await requireBoss();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 pt-3">
          <Link
            href="/boss"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white"
          >
            AE
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">AttendEase Admin</p>
            <p className="truncate text-[11px] text-slate-500">
              {session.name} • Boss / Administrator
            </p>
          </div>
          <SignOutForm compact />
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pb-2">
          <BossNav />
        </div>
      </header>

      <div className="flex-1">{children}</div>
    </>
  );
}
