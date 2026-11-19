// ============================================================
// Role labels and capability checks shared by the server pages
// and the client navigation. Pure functions only.
// ============================================================

import type { Role } from '@/lib/session-core'

export const STAFF_ROLES: Role[] = ['admin', 'hr', 'manager']

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  hr: 'HR Manager',
  manager: 'Manager',
  employee: 'Employee',
}

/** Add / edit employee records and reset employee passwords. */
export function canManageEmployees(role: Role): boolean {
  return role === 'admin' || role === 'hr'
}

/** Permanently delete an employee, manage staff accounts and owner settings. */
export function canDeleteEmployees(role: Role): boolean {
  return role === 'admin'
}

/** Approve or reject attendance and leave requests. */
export function canReview(role: Role): boolean {
  return role === 'admin' || role === 'hr' || role === 'manager'
}

/** Operate the entrance gate and require its rotating code. */
export function canUseGate(role: Role): boolean {
  return role === 'admin' || role === 'hr'
}

/** Company-wide reports and payroll. */
export function canSeeReports(role: Role): boolean {
  return role === 'admin' || role === 'manager'
}

/** Create, deactivate or reset HR / manager accounts. */
export function canManageStaff(role: Role): boolean {
  return role === 'admin'
}
