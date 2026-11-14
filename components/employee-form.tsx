"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Save, UserPlus } from "lucide-react";
import PasswordInput from "@/components/password-input";
import { createEmployeeAction, updateEmployeeAction } from "@/lib/employees";
import {
  DEPARTMENT_SUGGESTIONS,
  EMPLOYEE_STATUS_META,
  type EmployeeFormState,
  type EmployeeStatus,
} from "@/lib/employee-shared";

type EmployeeRecord = {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string;
  cnic: string;
  phone: string;
  department: string;
  jobTitle: string;
  joiningDate: string;
  monthlySalary: number;
  annualLeaveAllowance: number;
  status: EmployeeStatus;
};

type Props =
  | { mode: "create"; departments: string[]; suggestedCode: string; defaultJoiningDate: string }
  | { mode: "edit"; departments: string[]; employee: EmployeeRecord };

type Values = {
  fullName: string;
  email: string;
  employeeCode: string;
  cnic: string;
  phone: string;
  department: string;
  jobTitle: string;
  joiningDate: string;
  monthlySalary: string;
  annualLeaveAllowance: string;
  status: EmployeeStatus;
  password: string;
};

function initialValues(props: Props): Values {
  if (props.mode === "edit") {
    return {
      fullName: props.employee.fullName,
      email: props.employee.email,
      employeeCode: props.employee.employeeCode,
      cnic: props.employee.cnic,
      phone: props.employee.phone,
      department: props.employee.department,
      jobTitle: props.employee.jobTitle,
      joiningDate: props.employee.joiningDate,
      monthlySalary: String(props.employee.monthlySalary),
      annualLeaveAllowance: String(props.employee.annualLeaveAllowance),
      status: props.employee.status,
      password: "",
    };
  }
  return {
    fullName: "",
    email: "",
    employeeCode: props.suggestedCode,
    cnic: "",
    phone: "",
    department: "",
    jobTitle: "",
    joiningDate: props.defaultJoiningDate,
    monthlySalary: "",
    annualLeaveAllowance: "20",
    status: "active",
    password: "",
  };
}

export default function EmployeeForm(props: Props) {
  const isEdit = props.mode === "edit";
  const [values, setValues] = useState<Values>(() => initialValues(props));
  const [state, formAction, pending] = useActionState<EmployeeFormState, FormData>(
    isEdit ? updateEmployeeAction : createEmployeeAction,
    undefined,
  );

  const fieldErrors = state?.fieldErrors ?? {};
  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const departmentOptions = Array.from(
    new Set([...DEPARTMENT_SUGGESTIONS, ...props.departments].filter(Boolean)),
  ).sort();

  const errorText = (key: string) =>
    fieldErrors[key] ? (
      <p className="mt-1 text-[11px] font-medium text-rose-600">{fieldErrors[key]}</p>
    ) : null;

  return (
    <form action={formAction} className="card space-y-5">
      {isEdit && <input type="hidden" name="employee_id" value={props.employee.id} />}

      {state?.error && (
        <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}

      <div>
        <p className="section-title">Identity</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="full_name">
              Full name
            </label>
            <input
              id="full_name"
              name="full_name"
              required
              value={values.fullName}
              onChange={(event) => set("fullName", event.target.value)}
              placeholder="e.g. Hina Qureshi"
              className="input"
            />
            {errorText("full_name")}
          </div>
          <div>
            <label className="label" htmlFor="employee_code">
              Employee code
            </label>
            <input
              id="employee_code"
              name="employee_code"
              required
              value={values.employeeCode}
              onChange={(event) => set("employeeCode", event.target.value.toUpperCase())}
              placeholder="EMP-1005"
              className="input font-mono"
            />
            {errorText("employee_code")}
          </div>
          <div>
            <label className="label" htmlFor="cnic">
              CNIC <span className="font-normal normal-case text-slate-400">(optional)</span>
            </label>
            <input
              id="cnic"
              name="cnic"
              value={values.cnic}
              onChange={(event) => set("cnic", event.target.value)}
              placeholder="42101-1234567-1"
              className="input font-mono"
            />
            {errorText("cnic")}
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone <span className="font-normal normal-case text-slate-400">(optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              value={values.phone}
              onChange={(event) => set("phone", event.target.value)}
              placeholder="0300-1234567"
              className="input"
            />
            {errorText("phone")}
          </div>
        </div>
      </div>

      <div>
        <p className="section-title">Role &amp; placement</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="department">
              Department
            </label>
            <input
              id="department"
              name="department"
              list="department-options"
              value={values.department}
              onChange={(event) => set("department", event.target.value)}
              placeholder="Engineering"
              className="input"
            />
            <datalist id="department-options">
              {departmentOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {errorText("department")}
          </div>
          <div>
            <label className="label" htmlFor="job_title">
              Job title
            </label>
            <input
              id="job_title"
              name="job_title"
              value={values.jobTitle}
              onChange={(event) => set("jobTitle", event.target.value)}
              placeholder="Software Engineer"
              className="input"
            />
            {errorText("job_title")}
          </div>
          <div>
            <label className="label" htmlFor="joining_date">
              Joining date
            </label>
            <input
              id="joining_date"
              name="joining_date"
              type="date"
              required
              value={values.joiningDate}
              onChange={(event) => set("joiningDate", event.target.value)}
              className="input"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Attendance, absence and late fines start from this date — earlier days are ignored.
            </p>
            {errorText("joining_date")}
          </div>
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={values.status}
              onChange={(event) => set("status", event.target.value as EmployeeStatus)}
              className="input"
            >
              <option value="active">{EMPLOYEE_STATUS_META.active.label}</option>
              <option value="inactive">{EMPLOYEE_STATUS_META.inactive.label}</option>
            </select>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Inactive employees cannot sign in, but their history is kept.
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="section-title">Pay &amp; leave</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="monthly_salary">
              Monthly salary (Rs.)
            </label>
            <input
              id="monthly_salary"
              name="monthly_salary"
              type="number"
              min={0}
              step={1000}
              value={values.monthlySalary}
              onChange={(event) => set("monthlySalary", event.target.value)}
              placeholder="60000"
              className="input"
            />
            {errorText("monthly_salary")}
          </div>
          <div>
            <label className="label" htmlFor="annual_leave_allowance">
              Annual leave allowance (days)
            </label>
            <input
              id="annual_leave_allowance"
              name="annual_leave_allowance"
              type="number"
              min={0}
              step={1}
              value={values.annualLeaveAllowance}
              onChange={(event) => set("annualLeaveAllowance", event.target.value)}
              placeholder="20"
              className="input"
            />
            {errorText("annual_leave_allowance")}
          </div>
        </div>
      </div>

      <div>
        <p className="section-title">Login account</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="email">
              Email (used to sign in)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={values.email}
              onChange={(event) => set("email", event.target.value)}
              placeholder="name@company.com"
              className="input"
            />
            {errorText("email")}
          </div>
          <div>
            <label className="label" htmlFor="password">
              {isEdit ? (
                <>
                  New password <span className="font-normal normal-case text-slate-400">(leave blank to keep current)</span>
                </>
              ) : (
                "Starting password"
              )}
            </label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required={!isEdit}
              minLength={6}
              value={values.password}
              onChange={(event) => set("password", event.target.value)}
              placeholder="At least 6 characters"
              className="input"
            />
            {errorText("password")}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          The password is hashed with bcrypt and is never shown again. The employee can change it later from My Profile.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isEdit ? (
            <Save className="h-4 w-4" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create employee"}
        </button>
        <Link
          href={isEdit ? `/boss/employees/${props.employee.id}` : "/boss/employees"}
          className="btn btn-ghost"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
