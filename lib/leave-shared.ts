// ============================================================
// Leave helpers shared by the server actions and the client form.
// No "use server" here so it can be imported from Client Components.
// ============================================================

export const LEAVE_TYPES = ['annual', 'sick', 'casual', 'unpaid', 'emergency'] as const

export type LeaveType = (typeof LEAVE_TYPES)[number]

export const LEAVE_TYPE_META: Record<LeaveType, { label: string; paid: boolean; note: string }> = {
  annual: { label: 'Annual leave', paid: true, note: 'Deducted from your yearly allowance.' },
  sick: { label: 'Sick leave', paid: true, note: 'Paid; a medical note may be requested.' },
  casual: { label: 'Casual leave', paid: true, note: 'Short personal leave, paid.' },
  unpaid: { label: 'Unpaid leave', paid: false, note: 'Deducted from salary as a full day.' },
  emergency: { label: 'Emergency leave', paid: true, note: 'Flagged to the boss for priority review.' },
}

export type LeaveFormState = { error?: string; success?: string } | undefined

export const LEAVE_STATUS_META: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'slate' },
  submitted: { label: 'Awaiting review', tone: 'yellow' },
  pending: { label: 'Awaiting review', tone: 'yellow' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
}
