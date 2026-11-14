"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Loader2, LockKeyhole, LogIn, Mail } from "lucide-react";
import PasswordInput from "@/components/password-input";
import { loginAction, type LoginState } from "@/lib/auth";
import { SHOW_DEMO_ACCOUNTS } from "@/lib/demo-config";

type Role = "employee" | "boss";

const DEMO_ACCOUNTS: Record<Role, { email: string; password: string; label: string; note: string }[]> = {
  employee: [
    { email: "ali@demo.com", password: "employee123", label: "Ali Raza", note: "Web Development • 2 absences, 3 late days" },
    { email: "ayesha@demo.com", password: "employee123", label: "Ayesha Khan", note: "Design • on leave 10–11 Nov" },
    { email: "bilal@demo.com", password: "employee123", label: "Bilal Ahmed", note: "Sales • has an offline (pending) event" },
    { email: "sana@demo.com", password: "employee123", label: "Sana Malik", note: "HR • leave request was rejected" },
  ],
  boss: [
    { email: "boss@demo.com", password: "boss123", label: "Hamza Sheikh", note: "Managing Director — full access" },
  ],
};

export default function LoginForm({ initialRole }: { initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, undefined);

  function fillAccount(account: { email: string; password: string }) {
    setEmail(account.email);
    setPassword(account.password);
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(["employee", "boss"] as Role[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRole(option)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              role === option ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {option === "employee" ? "Employee" : "Boss / Admin"}
          </button>
        ))}
      </div>

      <form action={formAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="input pl-9"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="input pl-9"
            />
          </div>
        </div>

        {state?.error && (
          <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {SHOW_DEMO_ACCOUNTS && (
        <div className="mt-5">
          <p className="section-title">Demo accounts — tap to fill</p>
          <div className="mt-2 space-y-2">
          {DEMO_ACCOUNTS[role].map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillAccount(account)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-800">{account.label}</span>
                <span className="block font-mono text-[11px] text-slate-500">{account.email}</span>
                <span className="block text-[11px] text-slate-500">{account.note}</span>
              </span>
              <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                Fill
              </span>
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
