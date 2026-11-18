// ============================================================
// Anti-fraud helpers for attendance capture (pure, no native deps).
//
// Two independent checks run on every accepted event:
//   1. Duplicate selfie  — a 64-bit perceptual hash (dHash) of the
//      selfie is compared with the employee's previous captures.
//   2. Impossible travel — two GPS fixes that are further apart than
//      a person could physically travel in the elapsed time.
//
// Neither check blocks a check-in. They set `verification = 'flagged'`
// and put the event in the boss review queue, so a human always decides.
// ============================================================

import { distanceMeters } from '@/lib/time'

/** Same photo if the 64-bit hashes differ by at most this many bits. */
export const DUPLICATE_HASH_DISTANCE = 4

/** Re-captures within this window on the same day are not compared (legit retake). */
export const DUPLICATE_MIN_GAP_MINUTES = 60

/** Faster than this is not possible on the ground, so the fix is suspect. */
export const IMPOSSIBLE_TRAVEL_SPEED_KMH = 250

/** Only look this far back: a long gap makes distance meaningless. */
export const IMPOSSIBLE_TRAVEL_WINDOW_HOURS = 6

/** Ignore sub-kilometre differences; that is normal GPS jitter. */
export const IMPOSSIBLE_TRAVEL_MIN_KM = 2

export type FraudFlag = 'duplicate_selfie' | 'impossible_travel'

export const FRAUD_FLAG_LABELS: Record<FraudFlag, string> = {
  duplicate_selfie: 'Duplicate selfie',
  impossible_travel: 'Impossible travel',
}

/** Human labels for a `fraud_flags` string such as `duplicate_selfie,impossible_travel`. */
export function fraudFlagLabels(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((flag) => flag.trim())
    .filter((flag): flag is FraudFlag => flag === 'duplicate_selfie' || flag === 'impossible_travel')
    .map((flag) => FRAUD_FLAG_LABELS[flag])
}

/** Bit distance between two 16-character hex dHashes. */
export function hammingDistanceHex(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY
  let distance = 0
  for (let i = 0; i < a.length; i += 1) {
    let xor = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (xor) {
      distance += xor & 1
      xor >>= 1
    }
  }
  return distance
}

/** An earlier attendance row, as needed by the two checks. */
export type CaptureSignal = {
  event_id: string
  type: 'check_in' | 'check_out'
  work_date: string
  server_time: string
  latitude: number | null
  longitude: number | null
  photo_hash: string | null
  photo_sha: string | null
}

const clockOf = (stamp: string) => stamp.slice(11, 16)
const minutesBetween = (from: string, to: string) => {
  const start = Date.parse(from)
  const end = Date.parse(to)
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.POSITIVE_INFINITY
  return (end - start) / 60_000
}

export type DuplicateMatch = {
  /** 0 means byte-for-byte identical; up to DUPLICATE_HASH_DISTANCE means visually the same. */
  distance: number
  exact: boolean
  match: CaptureSignal
}

/**
 * Find an earlier capture that reused the same selfie.
 *
 * `exact` uses the SHA-256 of the decoded image, so an identical upload is
 * caught even if the perceptual hash could not be computed. Near-duplicates
 * use the dHash distance. Retakes on the same day within an hour are ignored.
 */
export function findDuplicateSelfie(
  signals: CaptureSignal[],
  serverTime: string,
  hashes: { sha: string; dhash: string | null },
): DuplicateMatch | null {
  for (const signal of signals) {
    if (!signal.photo_sha && !signal.photo_hash) continue
    const gap = minutesBetween(signal.server_time, serverTime)
    if (signal.work_date === serverTime.slice(0, 10) && gap < DUPLICATE_MIN_GAP_MINUTES) continue

    if (signal.photo_sha === hashes.sha) {
      return { distance: 0, exact: true, match: signal }
    }
    if (hashes.dhash && signal.photo_hash) {
      const distance = hammingDistanceHex(signal.photo_hash, hashes.dhash)
      if (distance <= DUPLICATE_HASH_DISTANCE) {
        return { distance, exact: false, match: signal }
      }
    }
  }
  return null
}

export type TravelViolation = {
  km: number
  minutes: number
  speedKmh: number
  match: CaptureSignal
}

/**
 * Flag a fix that is too far from the previous capture to be real.
 * Only events inside the look-back window are considered.
 */
export function findImpossibleTravel(
  signals: CaptureSignal[],
  serverTime: string,
  latitude: number | null,
  longitude: number | null,
): TravelViolation | null {
  if (latitude === null || longitude === null) return null
  for (const signal of signals) {
    if (signal.latitude === null || signal.longitude === null) continue
    const minutes = minutesBetween(signal.server_time, serverTime)
    if (minutes < 0) continue
    if (minutes > IMPOSSIBLE_TRAVEL_WINDOW_HOURS * 60) continue

    const km = distanceMeters(latitude, longitude, signal.latitude, signal.longitude) / 1000
    if (km < IMPOSSIBLE_TRAVEL_MIN_KM) continue
    // Timestamps only have second precision, so a gap of 0 means the two
    // captures arrived in the same second — treat it as one second, never as
    // "infinitely fast but ignored".
    const elapsed = Math.max(minutes, 1 / 60)
    const speedKmh = km / (elapsed / 60)
    if (speedKmh > IMPOSSIBLE_TRAVEL_SPEED_KMH) {
      return { km: Math.round(km * 10) / 10, minutes: Math.round(minutes), speedKmh, match: signal }
    }
  }
  return null
}

/** Plain-language reason shown to the boss on the event card. */
export function describeDuplicate(match: DuplicateMatch): string {
  const how = match.exact ? 'identical to' : 'almost identical to'
  return `Selfie is ${how} the earlier ${match.match.type === 'check_in' ? 'check-in' : 'check-out'} selfie from ${match.match.work_date} ${clockOf(match.match.server_time)}`
}

export function describeTravel(violation: TravelViolation): string {
  const elapsed = violation.minutes < 1 ? 'under a minute' : `${violation.minutes} min`
  const reference = violation.match.type === 'check_in' ? 'check-in' : 'check-out'
  const speed = violation.speedKmh >= 5000 ? '' : ` (${Math.round(violation.speedKmh)} km/h)`
  return `Impossible travel: ${violation.km} km in ${elapsed}${speed} since the ${reference} at ${clockOf(
    violation.match.server_time,
  )}`
}
