import { NextResponse } from 'next/server'
import { answerQuestion } from '@/lib/assistant'
import { getSession } from '@/lib/session'

// Read-only question answering for staff (admin, HR and manager). No writes
// happen here, and the answer is built from the same queries the dashboard uses.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_QUESTION_LENGTH = 300

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  }
  if (session.role === 'employee') {
    return NextResponse.json({ error: 'The attendance desk is available to staff accounts only.' }, { status: 403 })
  }

  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ error: 'Send the question as JSON.' }, { status: 415 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'The request body was not valid JSON.' }, { status: 400 })
  }

  const raw =
    typeof payload === 'object' && payload !== null && typeof (payload as { question?: unknown }).question === 'string'
      ? ((payload as { question: string }).question as string)
      : ''

  const question = raw.trim()
  if (!question) {
    return NextResponse.json({ error: 'Type a question first.' }, { status: 400 })
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Please keep the question under ${MAX_QUESTION_LENGTH} characters.` },
      { status: 400 },
    )
  }

  try {
    const answer = await answerQuestion(question, session.userId)
    return NextResponse.json(answer)
  } catch (error) {
    // Never let the browser receive an HTML error page: it would break the
    // JSON reader and show a "json not responded" style message.
    console.error('assistant question failed', error)
    return NextResponse.json(
      { error: 'The attendance data could not be read right now. Please try again in a moment.' },
      { status: 500 },
    )
  }
}
