"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Loader2, LockKeyhole, LogIn, Mail } from "lucide-react";
import PasswordInput from "@/components/password-input";
import { loginAction, type LoginState } from "@/lib/auth";

type Role = "employee" | "staff";

export default function LoginForm({ initialRole }: { initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, undefined);

  return (
    <div className="w-full max-w-md">
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(["employee", "staff"] as Role[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRole(option)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              role === option ? "bg-white text-blue-950 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {option === "employee" ? "Employee" : "Staff / Admin"}
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
    </div>
  );
}
