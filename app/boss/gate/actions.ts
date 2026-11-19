'use server'

import { revalidatePath } from 'next/cache'
import { run } from '@/lib/db'
import { requireHr } from '@/lib/session'
import { toServerTime } from '@/lib/time'

/** Turn the "entrance code required" policy on or off. */
export async function setGateRequirement(formData: FormData): Promise<void> {
  await requireHr()
  const enabled = formData.get('enabled') === '1'
  await run('UPDATE settings SET require_gate_code = ?, updated_at = ? WHERE id = 1', [
    enabled ? 1 : 0,
    toServerTime(),
  ])
  revalidatePath('/boss/gate')
  revalidatePath('/boss')
  revalidatePath('/app')
  revalidatePath('/app/check-in')
  revalidatePath('/app/check-out')
}
