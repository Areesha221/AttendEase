"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarCheck, GraduationCap, LayoutDashboard, ScanFace, Users, UserCog } from "lucide-react";

const LINKS = [
  { href: "/boss", label: "Dashboard", icon: LayoutDashboard },
  { href: "/boss/employees", label: "Employees", icon: Users },
  { href: "/boss/attendance", label: "Attendance", icon: ScanFace },
  { href: "/boss/leave", label: "Leave", icon: CalendarCheck },
  { href: "/boss/reports", label: "Reports", icon: BarChart3 },
  { href: "/careers", label: "Careers", icon: GraduationCap },
  { href: "/boss/profile", label: "Profile", icon: UserCog },
] as const;

export default function BossNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/boss" ? pathname === "/boss" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {LINKS.map((link) => {
        const active = isActive(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
