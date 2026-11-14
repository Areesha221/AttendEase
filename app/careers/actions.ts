'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/session'
import { toggleSavedProgram } from '@/lib/careers'

/**
 * Add or remove a program from the signed-in user's shortlist.
 * The shortlist is keyed by the session user id, so each account has its own.
 */
export async function toggleSavedAction(formData: FormData): Promise<void> {
  const session = await requireSession()
  const programId = String(formData.get('programId') ?? '')
  if (!programId) return

  toggleSavedProgram(session.userId, programId)

  const back = String(formData.get('revalidate') ?? '')
  if (back) revalidatePath(back)
  revalidatePath('/careers')
  revalidatePath('/careers/saved')
}
