import { NextResponse } from 'next/server'
import { all, get } from '@/lib/db'
import { toServerTime } from '@/lib/time'

export const dynamic = 'force-dynamic'

/**
 * Simple health probe: proves the SQLite layer works inside the
 * Next.js server runtime and shows how much demo data is loaded.
 */
export async function GET() {
  const settings = await get<{ office_name: string; radius_m: number; work_start: string; work_end: string }>(
    'SELECT office_name, radius_m, work_start, work_end FROM settings WHERE id = 1',
  )
  const counts = await get<{
    employees: number
    attendance: number
    leaves: number
    pending_leaves: number
    countries: number
    universities: number
    programs: number
  }>(`SELECT
        (SELECT COUNT(*) FROM employees WHERE status = 'active') AS employees,
        (SELECT COUNT(*) FROM attendance) AS attendance,
        (SELECT COUNT(*) FROM leaves) AS leaves,
        (SELECT COUNT(*) FROM leaves WHERE status IN ('pending','submitted')) AS pending_leaves,
        (SELECT COUNT(*) FROM countries) AS countries,
        (SELECT COUNT(*) FROM universities) AS universities,
        (SELECT COUNT(*) FROM programs) AS programs`)

  const upcomingDeadlines = await all<{ name: string; deadline: string }>(
    `SELECT name, deadline FROM programs WHERE deadline >= date('now') ORDER BY deadline LIMIT 5`,
  )

  return NextResponse.json({
    ok: true,
    serverTimePkt: toServerTime(),
    settings,
    counts,
    upcomingDeadlines,
  })
}
