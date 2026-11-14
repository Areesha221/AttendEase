// ============================================================
// Employee administration helpers shared by the server actions
// and the client forms.
// No "use server" here so it can be imported from Client Components.
// ============================================================

export const EMPLOYEE_STATUSES = ['active', 'inactive'] as const

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]

export const EMPLOYEE_STATUS_META: Record<EmployeeStatus, { label: string; tone: 'green' | 'slate' }> = {
  active: { label: 'Active', tone: 'green' },
  inactive: { label: 'Inactive', tone: 'slate' },
}

/** Suggested departments shown in the form (free text is still allowed). */
export const DEPARTMENT_SUGGESTIONS = [
  'Engineering',
  'Design',
  'Sales',
  'Human Resources',
  'Finance',
  'Marketing',
  'Operations',
  'Medical',
  'Administration',
]

export type EmployeeFormState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined

export type PasswordFormState =
  | { error?: string; success?: string; fieldErrors?: Record<string, string> }
  | undefined

export type EmployeeInput = {
  fullName: string
  email: string
  employeeCode: string
  password: string
  cnic: string
  phone: string
  department: string
  jobTitle: string
  joiningDate: string
  monthlySalary: number
  annualLeaveAllowance: number
  status: EmployeeStatus
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Minimum length for every password in the app. */
export const MIN_PASSWORD_LENGTH = 6

/**
 * Parse and validate the employee create/edit form.
 * On success returns `{ data }`; otherwise returns `{ fieldErrors }`.
 */
export function validateEmployeeInput(
  formData: FormData,
  options: { requirePassword: boolean },
): { data: EmployeeInput } | { fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {}

  const fullName = String(formData.get('full_name') ?? '').trim()
  if (!fullName) fieldErrors.full_name = 'Full name is required.'

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email) fieldErrors.email = 'Email is required.'
  else if (!EMAIL_RE.test(email)) fieldErrors.email = 'Enter a valid email address.'

  const employeeCode = String(formData.get('employee_code') ?? '').trim().toUpperCase()
  if (!employeeCode) fieldErrors.employee_code = 'Employee code is required.'

  const password = String(formData.get('password') ?? '')
  if (options.requirePassword && !password) {
    fieldErrors.password = 'A starting password is required.'
  } else if (password && password.length < MIN_PASSWORD_LENGTH) {
    fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  }

  const joiningDate = String(formData.get('joining_date') ?? '').trim()
  if (!joiningDate) fieldErrors.joining_date = 'Joining date is required.'
  else if (!DATE_RE.test(joiningDate)) fieldErrors.joining_date = 'Use a valid date.'

  const salaryRaw = String(formData.get('monthly_salary') ?? '').trim()
  const monthlySalary = salaryRaw === '' ? 0 : Number(salaryRaw)
  if (Number.isNaN(monthlySalary) || monthlySalary < 0) {
    fieldErrors.monthly_salary = 'Enter a valid amount (0 or more).'
  }

  const allowanceRaw = String(formData.get('annual_leave_allowance') ?? '').trim()
  const annualLeaveAllowance = allowanceRaw === '' ? 20 : Number(allowanceRaw)
  if (!Number.isInteger(annualLeaveAllowance) || annualLeaveAllowance < 0) {
    fieldErrors.annual_leave_allowance = 'Enter a whole number of days.'
  }

  const status: EmployeeStatus = String(formData.get('status') ?? 'active') === 'inactive' ? 'inactive' : 'active'

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  return {
    data: {
      fullName,
      email,
      employeeCode,
      password,
      cnic: String(formData.get('cnic') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim(),
      department: String(formData.get('department') ?? '').trim(),
      jobTitle: String(formData.get('job_title') ?? '').trim(),
      joiningDate,
      monthlySalary,
      annualLeaveAllowance,
      status,
    },
  }
}

/** Validate a new password + confirmation. Returns an error message or null. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (!password) return 'Enter a new password.'
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  if (password !== confirm) return 'The two passwords do not match.'
  return null
}
