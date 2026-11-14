"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus, CheckCircle2, Loader2 } from "lucide-react";
import { createLeaveAction } from "@/lib/leave";
import { LEAVE_TYPES, LEAVE_TYPE_META, type LeaveFormState, type LeaveType } from "@/lib/leave-shared";

type Props = {
  weekendDays: string;
  holidays: string[];
  today: string;
};

function countWorkingDays(start: string, end: string, weekendDays: string, holidays: string[]): number {
  if (!start || !end || end < start) return 0;
  const weekend = weekendDays.split(",").map((value) => Number(value.trim()));
  const holidaySet = new Set(holidays);
  let total = 0;
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    const iso = cursor.toISOString().slice(0, 10);
    const day = cursor.getUTCDay();
    if (!weekend.includes(day) && !holidaySet.has(iso)) total += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return total;
}

export default function LeaveForm({ weekendDays, holidays, today }: Props) {
  const [type, setType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [emergency, setEmergency] = useState(false);
  const [state, formAction, pending] = useActionState<LeaveFormState, FormData>(createLeaveAction, undefined);

  const workingDays = useMemo(
    () => countWorkingDays(startDate, endDate, weekendDays, holidays),
    [startDate, endDate, weekendDays, holidays],
  );

  return (
    <form action={formAction} className="card space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="type">
            Leave type
          </label>
          <select
            id="type"
            name="type"
            value={type}
            onChange={(event) => {
              const next = event.target.value as LeaveType;
              setType(next);
              if (next === "emergency") setEmergency(true);
            }}
            className="input"
          >
            {LEAVE_TYPES.map((option) => (
              <option key={option} value={option}>
                {LEAVE_TYPE_META[option].label}
                {LEAVE_TYPE_META[option].paid ? "" : " (unpaid)"}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-slate-500">{LEAVE_TYPE_META[type].note}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="start_date">
              From
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              required
              min={today}
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                if (endDate < event.target.value) setEndDate(event.target.value);
              }}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="end_date">
              To
            </label>
            <input
              id="end_date"
              name="end_date"
              type="date"
              required
              min={startDate || today}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="reason">
          Reason
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          placeholder="Short reason for your manager (optional for casual leave)."
          className="input resize-none"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="emergency"
          checked={emergency}
          onChange={(event) => setEmergency(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Mark as emergency (notifies the boss immediately)
      </label>

      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3">
        <span className="text-xs font-medium text-slate-600">Working days in this range (weekends/holidays excluded)</span>
        <span className="text-lg font-bold text-slate-900">{workingDays}</span>
      </div>

      {state?.error && (
        <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.success}
        </p>
      )}

      <button type="submit" disabled={pending || workingDays === 0} className="btn btn-primary w-full">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
        {pending ? "Sending…" : "Submit leave request"}
      </button>
    </form>
  );
}
