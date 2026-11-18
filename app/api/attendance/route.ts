// ============================================================
// Attendance capture endpoint.
//
// Accepts one or more check-in / check-out events (a single live
// submission, or a batch flushed from the offline queue).
//
// Security / integrity rules:
//   * The signed-in session decides which employee the event belongs to.
//   * The SERVER clock (Asia/Karachi) is authoritative — the device
//     time is stored only for comparison.
//   * Distance from the office is recomputed on the server; the client
//     hint is never trusted.
//   * Duplicate event ids are ignored, so an offline retry cannot
//     create a second row.
// ============================================================

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { get, newId, run } from '@/lib/db'
import {
  getEmployeeByUserId,
  getEventsForDate,
  getSettings,
  listCaptureSignals,
} from '@/lib/queries'
import { GPS_ACCURACY_LIMIT_M } from '@/lib/rules'
import {
  describeDuplicate,
  describeTravel,
  findDuplicateSelfie,
  findImpossibleTravel,
  type FraudFlag,
} from '@/lib/fraud'
import { photoFingerprint } from '@/lib/photo-hash'
import { normalizeGateCode, verifyGateCode } from '@/lib/gate'
import { distanceMeters, toServerTime, toWorkDate } from '@/lib/time'

type IncomingEvent = {
  eventId?: unknown
  type?: unknown
  deviceTime?: unknown
  photo?: unknown
  latitude?: unknown
  longitude?: unknown
  accuracyM?: unknown
  gateCode?: unknown
}

type EventResult = {
  eventId: string | null
  type: 'check_in' | 'check_out' | null
  status: 'accepted' | 'duplicate' | 'rejected'
  message?: string
  serverTime?: string
  workDate?: string
  distanceM?: number | null
  locationStatus?: 'inside' | 'outside' | 'unavailable'
  verification?: 'verified' | 'flagged' | 'pending'
  fraudFlags?: string
  gateStatus?: 'valid' | 'invalid' | 'missing' | 'not_required'
}

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

// An event is treated as an offline capture when the device clock is more than
// 10 minutes behind the server (normal request latency is seconds) and no more
// than 7 days old. Its original device date/time is then used so a queued
// check-in from a previous day is stored on that day — and flagged for review.
const CLOCK_SKEW_MS = 10 * 60 * 1000
const OFFLINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const offlineCapturedAt = (deviceTime: string | null, now: Date): Date | null => {
  if (!deviceTime) return null
  const parsed = new Date(deviceTime)
  if (Number.isNaN(parsed.getTime())) return null
  const age = now.getTime() - parsed.getTime()
  if (age <= CLOCK_SKEW_MS || age > OFFLINE_WINDOW_MS) return null
  return parsed
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 })
  }
  if (session.role !== 'employee') {
    return NextResponse.json({ error: 'Only employee accounts can record attendance.' }, { status: 403 })
  }

  const employee = await getEmployeeByUserId(session.userId)
  if (!employee) {
    return NextResponse.json({ error: 'No employee profile is linked to this account.' }, { status: 400 })
  }

  let body: { events?: IncomingEvent[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const incoming = Array.isArray(body.events) ? body.events : []
  if (incoming.length === 0) {
    return NextResponse.json({ error: 'No attendance events were provided.' }, { status: 400 })
  }

  const settings = await getSettings()
  const now = new Date()
  const serverTime = toServerTime(now)
  const workDate = toWorkDate(now)
  const results: EventResult[] = []
  let acceptedCount = 0
  const acceptedDates = new Set<string>()

  for (const event of incoming) {
    const type = event.type === 'check_in' || event.type === 'check_out' ? event.type : null
    const eventId = typeof event.eventId === 'string' && event.eventId.length > 0 ? event.eventId : null

    if (!type) {
      results.push({ eventId, type: null, status: 'rejected', message: 'Unknown attendance type.' })
      continue
    }
    if (!eventId) {
      results.push({ eventId: null, type, status: 'rejected', message: 'Missing event id.' })
      continue
    }

    const deviceTime = typeof event.deviceTime === 'string' ? event.deviceTime : null
    const capturedAt = offlineCapturedAt(deviceTime, now)
    const offlineCapture = capturedAt !== null
    const eventWorkDate = capturedAt ? toWorkDate(capturedAt) : workDate
    const eventServerTime = capturedAt ? toServerTime(capturedAt) : serverTime

    if (employee.joining_date && eventWorkDate < employee.joining_date) {
      results.push({
        eventId,
        type,
        status: 'rejected',
        message: `Attendance starts from your joining date (${employee.joining_date}).`,
      })
      continue
    }

    const photo = typeof event.photo === 'string' ? event.photo : ''
    if (!photo.startsWith('data:image/')) {
      results.push({ eventId, type, status: 'rejected', message: 'A selfie photo is required.' })
      continue
    }
    if (photo.length > 1_500_000) {
      results.push({ eventId, type, status: 'rejected', message: 'Selfie photo is too large.' })
      continue
    }

    const duplicate = await get<{ id: string }>('SELECT id FROM attendance WHERE event_id = ?', [eventId])
    if (duplicate) {
      results.push({ eventId, type, status: 'duplicate', message: 'This event was already saved.' })
      continue
    }

    const dayEvents = (await getEventsForDate(employee.id, eventWorkDate)).filter(
      (row) => row.review_status !== 'rejected',
    )
    const hasCheckIn = dayEvents.some((row) => row.type === 'check_in')
    const hasCheckOut = dayEvents.some((row) => row.type === 'check_out')

    if (type === 'check_in' && hasCheckIn) {
      results.push({ eventId, type, status: 'rejected', message: 'You have already checked in for this date.' })
      continue
    }
    if (type === 'check_out' && !hasCheckIn) {
      results.push({ eventId, type, status: 'rejected', message: 'Please check in before checking out.' })
      continue
    }
    if (type === 'check_out' && hasCheckOut) {
      results.push({ eventId, type, status: 'rejected', message: 'You have already checked out for this date.' })
      continue
    }

    const latitude = numberOrNull(event.latitude)
    const longitude = numberOrNull(event.longitude)
    const accuracyM = numberOrNull(event.accuracyM)
    const distance =
      latitude !== null && longitude !== null
        ? distanceMeters(latitude, longitude, settings.office_lat, settings.office_lng)
        : null
    const locationStatus: 'inside' | 'outside' | 'unavailable' =
      distance === null ? 'unavailable' : distance <= settings.radius_m ? 'inside' : 'outside'
    const locationVerification: 'verified' | 'flagged' | 'pending' =
      locationStatus === 'inside' && !(accuracyM !== null && accuracyM > GPS_ACCURACY_LIMIT_M)
        ? 'verified'
        : locationStatus === 'inside'
          ? 'flagged'
          : locationStatus === 'outside'
            ? 'flagged'
            : 'pending'
    const reasonParts: string[] = []
    if (locationStatus === 'outside') {
      reasonParts.push(`Outside the office radius (${distance} m > ${settings.radius_m} m)`)
    } else if (locationStatus === 'unavailable') {
      reasonParts.push('Location unavailable on the device')
    } else if (accuracyM !== null && accuracyM > GPS_ACCURACY_LIMIT_M) {
      reasonParts.push(
        `GPS accuracy ±${Math.round(accuracyM)} m is too low to confirm the office radius`,
      )
    }
    if (offlineCapture) reasonParts.push('Captured offline — device date/time used')

    // ---- rotating entrance code -----------------------------------------
    // Proves the phone was at the office door at capture time. Only required
    // when the boss turns it on, so existing flows keep working.
    const gateRequired = settings.require_gate_code === 1
    const gateCode = normalizeGateCode(typeof event.gateCode === 'string' ? event.gateCode : '')
    const gateValid = verifyGateCode(gateCode)
    const gateStatus: 'valid' | 'invalid' | 'missing' | 'not_required' = gateValid
      ? 'valid'
      : gateRequired
        ? gateCode
          ? 'invalid'
          : 'missing'
        : 'not_required'
    if (gateStatus === 'missing') reasonParts.push('Entrance gate code was not entered')
    if (gateStatus === 'invalid') reasonParts.push('Entrance gate code was wrong or had expired')

    // ---- anti-fraud checks ----------------------------------------------
    // Neither check rejects the event: they mark it for human review, because
    // only the boss can tell a real problem (reused photo, spoofed GPS) from a
    // harmless coincidence.
    const fingerprint = await photoFingerprint(photo)
    const signals = await listCaptureSignals(employee.id, eventServerTime)
    const fraudFlags: FraudFlag[] = []

    const duplicateSelfie = fingerprint
      ? findDuplicateSelfie(signals, eventServerTime, fingerprint)
      : null
    if (duplicateSelfie) {
      fraudFlags.push('duplicate_selfie')
      reasonParts.push(describeDuplicate(duplicateSelfie))
    }

    const travel = findImpossibleTravel(signals, eventServerTime, latitude, longitude)
    if (travel) {
      fraudFlags.push('impossible_travel')
      reasonParts.push(describeTravel(travel))
    }

    const gateFailed = gateStatus === 'missing' || gateStatus === 'invalid'
    const verification = fraudFlags.length > 0 || gateFailed ? 'flagged' : locationVerification
    const fraudFlagsValue = fraudFlags.length > 0 ? fraudFlags.join(',') : null
    const reason = reasonParts.length ? reasonParts.join(' · ') : null

    // Events captured outside the office, synced late from the offline queue,
    // or carrying an anti-fraud flag land in the boss review queue.
    const reviewStatus = verification === 'flagged' || offlineCapture ? 'pending' : 'not_required'

    await run(
      `INSERT INTO attendance
         (id, event_id, employee_id, type, work_date, server_time, device_time, photo,
          latitude, longitude, accuracy_m, distance_m, location_status, sync_status, verification, review_status, reason,
          photo_hash, photo_sha, fraud_flags, gate_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId('att'),
        eventId,
        employee.id,
        type,
        eventWorkDate,
        eventServerTime,
        deviceTime,
        photo,
        latitude,
        longitude,
        accuracyM,
        distance,
        locationStatus,
        verification,
        reviewStatus,
        reason,
        fingerprint?.dhash ?? null,
        fingerprint?.sha ?? null,
        fraudFlagsValue,
        gateStatus,
        serverTime,
      ],
    )

    await run(
      `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity, entity_id, details, created_at)
       VALUES (?, ?, ?, 'create', 'attendance', ?, ?, ?)`,
      [
        newId('audit'),
        session.userId,
        employee.full_name,
        eventId,
        `${type === 'check_in' ? 'Check-in' : 'Check-out'} ${eventWorkDate} at ${eventServerTime.slice(11, 16)} — ${locationStatus}${
          offlineCapture ? ' (offline sync)' : ''
        }${fraudFlags.length ? ` · anti-fraud: ${fraudFlags.join(', ')}` : ''}`,
        serverTime,
      ],
    )

    acceptedCount += 1
    acceptedDates.add(eventWorkDate)
    results.push({
      eventId,
      type,
      status: 'accepted',
      serverTime: eventServerTime,
      workDate: eventWorkDate,
      distanceM: distance,
      locationStatus,
      verification,
      fraudFlags: fraudFlagsValue ?? undefined,
      gateStatus,
    })
  }

  if (acceptedCount > 0) {
    await run(
      `INSERT INTO notifications (id, user_id, title, body, kind, is_read, created_at)
       VALUES (?, NULL, ?, ?, ?, 0, ?)`,
      [
        newId('notif'),
        `${employee.full_name} recorded ${acceptedCount} attendance event(s)`,
        `${employee.employee_code} • ${employee.department ?? 'Unassigned'} • ${[...acceptedDates].sort().join(', ')}`,
        'info',
        serverTime,
      ],
    )
  }

  return NextResponse.json({ ok: true, serverTime, workDate, results })
}
