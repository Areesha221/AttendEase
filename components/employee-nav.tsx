"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, GraduationCap, Home, Plane, UserRound } from "lucide-react";

const LINKS = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/app/leave", label: "Leave", icon: Plane },
  { href: "/app/profile", label: "Profile", icon: UserRound },
  { href: "/careers", label: "Careers", icon: GraduationCap },
] as const;

export default function EmployeeNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);

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
