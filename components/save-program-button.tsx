'use client'

import { useFormStatus } from 'react-dom'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import { toggleSavedAction } from '@/app/careers/actions'

function SubmitButton({ saved, compact }: { saved: boolean; compact?: boolean }) {
  const { pending } = useFormStatus()
  const Icon = saved ? BookmarkCheck : Bookmark

  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={saved}
      title={saved ? 'Remove from shortlist' : 'Save to shortlist'}
      className={`btn btn-sm ${saved ? 'btn-success' : 'btn-ghost'} ${compact ? '' : 'px-3'}`}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {compact ? null : saved ? 'Saved' : 'Save'}
    </button>
  )
}

export default function SaveProgramButton({
  programId,
  saved,
  revalidate,
  compact = false,
}: {
  programId: string
  saved: boolean
  revalidate?: string
  compact?: boolean
}) {
  return (
    <form action={toggleSavedAction}>
      <input type="hidden" name="programId" value={programId} />
      {revalidate ? <input type="hidden" name="revalidate" value={revalidate} /> : null}
      <SubmitButton saved={saved} compact={compact} />
    </form>
  )
}
