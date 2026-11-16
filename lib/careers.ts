// ============================================================
// Study-abroad / university guidance module.
// Curated demo dataset (countries, universities, programs) plus a
// transparent, rule-based "suggestion engine" that scores programs
// against a student profile. Server-side only.
//
// NOTE: deadlines, fees and requirements are DEMO data collected for
// a college project. Every program keeps a `source_url` so the real,
// current figures can always be checked on the university website.
// ============================================================

import { all, get, run, newId } from '@/lib/db'
import { daysUntil, toServerTime, toWorkDate } from '@/lib/time'

export type Country = {
  id: string
  name: string
  code: string
  flag: string | null
  currency: string | null
  avg_tuition: number | null
  living_cost: number | null
  intakes: string | null
  visa_note: string | null
  work_rights: string | null
  summary: string | null
}

export type University = {
  id: string
  country_id: string
  name: string
  city: string | null
  world_rank: string | null
  website: string | null
  tuition_min: number | null
  tuition_max: number | null
  currency: string | null
  scholarship: string | null
  description: string | null
}

export type Program = {
  id: string
  university_id: string
  name: string
  level: string
  discipline: string
  duration_months: number
  tuition_per_year: number | null
  currency: string | null
  intake: string | null
  deadline: string | null
  ielts_min: number | null
  min_gpa: number | null
  min_percentage: number | null
  requirements: string | null
  scholarship_note: string | null
  source_url: string | null
}

export type ProgramRow = Program & {
  university_name: string
  university_city: string | null
  world_rank: string | null
  website: string | null
  university_scholarship: string | null
  university_tuition_min: number | null
  university_tuition_max: number | null
  country_id: string
  country_name: string
  country_code: string
  country_flag: string | null
  country_currency: string | null
  country_avg_tuition: number | null
  country_living_cost: number | null
}

const PROGRAM_SELECT = `
  SELECT p.*,
         u.name AS university_name, u.city AS university_city, u.world_rank, u.website,
         u.scholarship AS university_scholarship,
         u.tuition_min AS university_tuition_min, u.tuition_max AS university_tuition_max,
         c.id AS country_id, c.name AS country_name, c.code AS country_code, c.flag AS country_flag,
         c.currency AS country_currency, c.avg_tuition AS country_avg_tuition,
         c.living_cost AS country_living_cost
  FROM programs p
  JOIN universities u ON u.id = p.university_id
  JOIN countries c ON c.id = u.country_id
`

/** Parse the JSON `requirements` column into a string list. */
export function parseRequirements(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : []
  } catch {
    return []
  }
}

// ---------------- reads ----------------

export async function listCountries(): Promise<Country[]> {
  return all<Country>('SELECT * FROM countries ORDER BY name')
}

export async function getCountry(id: string): Promise<Country | undefined> {
  return get<Country>('SELECT * FROM countries WHERE id = ?', [id])
}

export type UniversityWithCount = University & {
  country_name: string
  country_code: string
  country_flag: string | null
  program_count: number
}

export async function listUniversities(options: { countryId?: string } = {}): Promise<UniversityWithCount[]> {
  const params: string[] = []
  let where = ''
  if (options.countryId) {
    where = 'WHERE u.country_id = ?'
    params.push(options.countryId)
  }
  return all<UniversityWithCount>(
    `SELECT u.*, c.name AS country_name, c.code AS country_code, c.flag AS country_flag,
            (SELECT COUNT(*) FROM programs p WHERE p.university_id = u.id) AS program_count
     FROM universities u
     JOIN countries c ON c.id = u.country_id
     ${where}
     ORDER BY c.name, u.name`,
    params,
  )
}

export async function getUniversity(id: string): Promise<UniversityWithCount | undefined> {
  return get<UniversityWithCount>(
    `SELECT u.*, c.name AS country_name, c.code AS country_code, c.flag AS country_flag,
            (SELECT COUNT(*) FROM programs p WHERE p.university_id = u.id) AS program_count
     FROM universities u
     JOIN countries c ON c.id = u.country_id
     WHERE u.id = ?`,
    [id],
  )
}

export type ProgramFilters = {
  search?: string
  countryId?: string
  level?: string
  discipline?: string
  universityId?: string
  limit?: number
}

/** Build the shared WHERE clause + params for a program filter set. */
function programWhere(filters: ProgramFilters): { where: string; params: (string | number)[] } {
  const clauses: string[] = []
  const params: (string | number)[] = []

  if (filters.countryId) {
    clauses.push('c.id = ?')
    params.push(filters.countryId)
  }
  if (filters.level && filters.level !== 'all') {
    clauses.push('p.level = ?')
    params.push(filters.level)
  }
  if (filters.discipline && filters.discipline !== 'all') {
    clauses.push('p.discipline = ?')
    params.push(filters.discipline)
  }
  if (filters.universityId) {
    clauses.push('p.university_id = ?')
    params.push(filters.universityId)
  }
  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`
    clauses.push('(lower(p.name) LIKE ? OR lower(u.name) LIKE ? OR lower(p.discipline) LIKE ? OR lower(c.name) LIKE ?)')
    params.push(term, term, term, term)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return { where, params }
}

export async function listPrograms(filters: ProgramFilters = {}): Promise<ProgramRow[]> {
  const { where, params } = programWhere(filters)
  const limit = filters.limit ?? 300
  return all<ProgramRow>(`${PROGRAM_SELECT} ${where} ORDER BY p.deadline IS NULL, p.deadline, u.name LIMIT ${limit}`, params)
}

/** Total programs matching a filter set, ignoring any display limit. */
export async function countPrograms(filters: ProgramFilters = {}): Promise<number> {
  const { where, params } = programWhere(filters)
  const row = await get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM programs p
     JOIN universities u ON u.id = p.university_id
     JOIN countries c ON c.id = u.country_id
     ${where}`,
    params,
  )
  return row?.n ?? 0
}

export async function getProgram(id: string): Promise<ProgramRow | undefined> {
  return get<ProgramRow>(`${PROGRAM_SELECT} WHERE p.id = ?`, [id])
}

export async function listDisciplines(): Promise<string[]> {
  return (await all<{ discipline: string }>('SELECT DISTINCT discipline FROM programs ORDER BY discipline')).map(
    (row) => row.discipline,
  )
}

export async function listLevels(): Promise<string[]> {
  return (await all<{ level: string }>('SELECT DISTINCT level FROM programs ORDER BY level')).map((row) => row.level)
}

/** Programs whose deadline falls within the next `days` days, soonest first. */
export async function listUpcomingDeadlines(days = 180, limit = 8): Promise<ProgramRow[]> {
  const today = toWorkDate()
  return (await listPrograms({ limit: 500 }))
    .filter((program) => {
      const left = daysUntil(program.deadline, today)
      return left !== null && left >= 0 && left <= days
    })
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    .slice(0, limit)
}

// ---------------- saved / shortlist ----------------

export async function listSavedProgramIds(profileName: string): Promise<string[]> {
  return (
    await all<{ program_id: string }>('SELECT program_id FROM saved_programs WHERE profile_name = ?', [profileName])
  ).map((row) => row.program_id)
}

export async function listSavedPrograms(profileName: string): Promise<ProgramRow[]> {
  return all<ProgramRow>(
    `${PROGRAM_SELECT}
     JOIN saved_programs s ON s.program_id = p.id
     WHERE s.profile_name = ?
     ORDER BY s.created_at DESC`,
    [profileName],
  )
}

export async function isProgramSaved(profileName: string, programId: string): Promise<boolean> {
  const row = await get<{ id: string }>('SELECT id FROM saved_programs WHERE profile_name = ? AND program_id = ?', [
    profileName,
    programId,
  ])
  return Boolean(row)
}

/** Add or remove a program from a profile's shortlist. Returns the new state. */
export async function toggleSavedProgram(profileName: string, programId: string): Promise<boolean> {
  if (await isProgramSaved(profileName, programId)) {
    await run('DELETE FROM saved_programs WHERE profile_name = ? AND program_id = ?', [profileName, programId])
    return false
  }
  await run('INSERT INTO saved_programs (id, profile_name, program_id, created_at) VALUES (?, ?, ?, ?)', [
    newId('saved'),
    profileName,
    programId,
    toServerTime(),
  ])
  return true
}

// ---------------- suggestion engine ----------------

export type StudentProfile = {
  name?: string
  level?: string
  discipline?: string
  countryId?: string
  budget?: number
  ielts?: number
  gpa?: number
  percentage?: number
}

export type SuggestionMatch = 'Excellent match' | 'Good match' | 'Possible match' | 'Stretch'

export type Suggestion = {
  program: ProgramRow
  score: number
  match: SuggestionMatch
  reasons: string[]
  gaps: string[]
  daysLeft: number | null
}

export const DISCIPLINES: string[] = [
  'Computer Science',
  'Data Science',
  'Cyber Security',
  'Information Technology',
  'Engineering',
  'Business',
  'Business Analytics',
  'Design',
  'Media',
  'Hospitality',
  'Medicine',
  'Dentistry',
  'Pharmacy',
  'Physiotherapy',
  'Nursing',
  'Public Health',
  'Psychology',
  'Law',
  'Education',
  'Architecture',
  'Agriculture',
]

function scoreProgram(program: ProgramRow, profile: StudentProfile): Suggestion {
  let points = 0
  let possible = 0
  const reasons: string[] = []
  const gaps: string[] = []

  // Discipline (weight 30)
  if (profile.discipline) {
    possible += 30
    if (program.discipline === profile.discipline) {
      points += 30
      reasons.push(`Matches your subject: ${program.discipline}`)
    } else {
      gaps.push(`Different subject (${program.discipline})`)
    }
  }

  // Level (weight 20)
  if (profile.level) {
    possible += 20
    if (program.level === profile.level) {
      points += 20
      reasons.push(`${program.level} level as you selected`)
    } else {
      gaps.push(`This is a ${program.level} program`)
    }
  }

  // Country (weight 20)
  if (profile.countryId) {
    possible += 20
    if (program.country_id === profile.countryId) {
      points += 20
      reasons.push(`In your preferred country: ${program.country_name}`)
    } else {
      gaps.push(`Located in ${program.country_name}`)
    }
  }

  // Budget (weight 20) — annual tuition
  if (typeof profile.budget === 'number' && profile.budget > 0 && program.tuition_per_year !== null) {
    possible += 20
    const fee = program.tuition_per_year
    if (fee <= profile.budget) {
      points += 20
      reasons.push(`Tuition fits your budget (${program.currency ?? ''} ${Math.round(fee).toLocaleString()}/yr)`)
    } else if (fee <= profile.budget * 1.25) {
      points += 8
      gaps.push(`Tuition slightly above budget (${program.currency ?? ''} ${Math.round(fee).toLocaleString()}/yr)`)
    } else {
      gaps.push(`Tuition above budget (${program.currency ?? ''} ${Math.round(fee).toLocaleString()}/yr)`)
    }
  }

  // IELTS (weight 15)
  if (typeof profile.ielts === 'number') {
    possible += 15
    if (program.ielts_min === null) {
      points += 15
      reasons.push('No IELTS score required')
    } else if (profile.ielts >= program.ielts_min) {
      points += 15
      reasons.push(`Your IELTS ${profile.ielts} meets the ${program.ielts_min} requirement`)
    } else {
      gaps.push(`Needs IELTS ${program.ielts_min}, you have ${profile.ielts}`)
    }
  }

  // Grades (weight 15) — accept GPA (4.0) or percentage
  const hasGrade = typeof profile.gpa === 'number' || typeof profile.percentage === 'number'
  if (hasGrade) {
    possible += 15
    const gpaOk =
      typeof profile.gpa === 'number' && program.min_gpa !== null ? profile.gpa >= program.min_gpa : false
    const pctOk =
      typeof profile.percentage === 'number' && program.min_percentage !== null
        ? profile.percentage >= program.min_percentage
        : false
    if (gpaOk || pctOk) {
      points += 15
      reasons.push('Your grades meet the minimum')
    } else if (program.min_gpa === null && program.min_percentage === null) {
      points += 15
      reasons.push('No strict grade cut-off')
    } else {
      const need = [
        program.min_gpa !== null ? `CGPA ${program.min_gpa}` : null,
        program.min_percentage !== null ? `${program.min_percentage}%` : null,
      ]
        .filter(Boolean)
        .join(' or ')
      gaps.push(`Needs ${need}`)
    }
  }

  // Deadline urgency (weight 5)
  const left = daysUntil(program.deadline)
  if (left !== null) {
    possible += 5
    if (left < 0) {
      gaps.push('Deadline already passed')
    } else if (left <= 60) {
      points += 5
      reasons.push(`Deadline in ${left} day${left === 1 ? '' : 's'} — apply soon`)
    } else {
      points += 3
    }
  }

  const score = possible > 0 ? Math.round((points / possible) * 100) : 0
  const match: SuggestionMatch =
    score >= 80 ? 'Excellent match' : score >= 60 ? 'Good match' : score >= 40 ? 'Possible match' : 'Stretch'

  return { program, score, match, reasons, gaps, daysLeft: left }
}

/** Rank every program against a profile and return the best matches. */
export async function suggestPrograms(profile: StudentProfile, limit = 12): Promise<Suggestion[]> {
  const hasAnyCriteria = Boolean(
    profile.discipline ||
      profile.level ||
      profile.countryId ||
      (profile.budget && profile.budget > 0) ||
      typeof profile.ielts === 'number' ||
      typeof profile.gpa === 'number' ||
      typeof profile.percentage === 'number',
  )

  const scored = (await listPrograms({ limit: 500 })).map((program) => scoreProgram(program, profile))

  if (!hasAnyCriteria) return []

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
    .slice(0, limit)
}

/** A short, human-readable label for a program's currency + fee. */
export function formatTuition(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) return 'Fee on request'
  const cur = currency ?? ''
  if (amount === 0) return 'No tuition fee'
  return `${cur} ${Math.round(amount).toLocaleString()}`
}
