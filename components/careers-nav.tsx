"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, GraduationCap, Sparkles } from "lucide-react";

const LINKS = [
  { href: "/careers", label: "Discover", icon: Compass },
  { href: "/careers/universities", label: "Universities", icon: GraduationCap },
  { href: "/careers/suggestions", label: "Suggestions", icon: Sparkles },
  { href: "/careers/saved", label: "Shortlist", icon: Bookmark },
] as const;

export default function CareersNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/careers" ? pathname === "/careers" : pathname === href || pathname.startsWith(`${href}/`);

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
              active ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
