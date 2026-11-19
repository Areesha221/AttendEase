"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  Clock,
  GraduationCap,
  LayoutDashboard,
  QrCode,
  ScanFace,
  Search,
  ShieldCheck,
  Users,
  UserCog,
} from "lucide-react";
import type { Role } from "@/lib/session-core";
import { canManageEmployees, canManageStaff, canSeeReports, canUseGate } from "@/lib/roles";

type LinkItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  show: (role: Role) => boolean;
};

const LINKS: LinkItem[] = [
  { href: "/boss", label: "Dashboard", icon: LayoutDashboard, show: () => true },
  { href: "/boss/me", label: "My attendance", icon: Clock, show: () => true },
  { href: "/boss/assistant", label: "Q&A", icon: Search, show: () => true },
  { href: "/boss/employees", label: "Employees", icon: Users, show: canManageEmployees },
  { href: "/boss/attendance", label: "Attendance", icon: ScanFace, show: () => true },
  { href: "/boss/gate", label: "Gate", icon: QrCode, show: canUseGate },
  { href: "/boss/leave", label: "Leave", icon: CalendarCheck, show: () => true },
  { href: "/boss/reports", label: "Reports", icon: BarChart3, show: canSeeReports },
  { href: "/boss/team", label: "Staff accounts", icon: ShieldCheck, show: canManageStaff },
  { href: "/careers", label: "Careers", icon: GraduationCap, show: () => true },
  { href: "/boss/profile", label: "Profile", icon: UserCog, show: () => true },
];

export default function BossNav({ role }: { role: Role }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/boss" ? pathname === "/boss" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {LINKS.filter((link) => link.show(role)).map((link) => {
        const active = isActive(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active ? "bg-blue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
