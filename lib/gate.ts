// ============================================================
// Rotating entrance ("gate") codes.
//
// A screen at the office entrance shows a QR code that changes every
// 30 seconds. The employee scans it with their phone (or types the
// 6-digit number) when checking in / out. The code proves the phone was
// physically at the entrance at that moment — GPS alone can be spoofed.
//
// The code is derived from a secret + the current 30-second step, so the
// server can validate it without storing anything. The previous step is
// also accepted, which tolerates the time it takes to scan and submit.
//
// Server-side only (uses node:crypto).
// ============================================================

import crypto from 'node:crypto'

export const GATE_STEP_SECONDS = 30
export const GATE_CODE_LENGTH = 6

/** How many previous steps stay valid (1 = up to ~60 seconds). */
const GATE_TOLERANCE_STEPS = 1

const gateSecret = (): string =>
  process.env.GATE_SECRET ??
  process.env.SESSION_SECRET ??
  'attend-ease-gate-dev-secret-change-me'

/** The 30-second window number for a moment in time. */
export function gateStep(at: number = Date.now()): number {
  return Math.floor(at / (GATE_STEP_SECONDS * 1000))
}

/** Deterministic 6-digit code for one step. */
function codeForStep(step: number): string {
  const digest = crypto
    .createHmac('sha256', gateSecret())
    .update(`attendance-gate:${step}`)
    .digest()
  const value = digest.readUInt32BE(0) % 1_000_000
  return String(value).padStart(GATE_CODE_LENGTH, '0')
}

/** The code currently shown on the entrance screen. */
export function currentGateCode(at: number = Date.now()): string {
  return codeForStep(gateStep(at))
}

/** Whole seconds until the displayed code rotates. */
export function gateSecondsRemaining(at: number = Date.now()): number {
  const elapsed = (at / 1000) % GATE_STEP_SECONDS
  return Math.max(1, Math.ceil(GATE_STEP_SECONDS - elapsed))
}

/**
 * One read of the clock for the entrance screen: the code to display and how
 * long it is still valid. Kept in this module so the page component stays pure.
 */
export function gateSnapshot(at: number = Date.now()): { code: string; secondsLeft: number } {
  return { code: currentGateCode(at), secondsLeft: gateSecondsRemaining(at) }
}

/** Keep only digits, so "123 456" / "123-456" both work. */
export function normalizeGateCode(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '').slice(0, GATE_CODE_LENGTH)
}

/**
 * Accept the current step and the previous one. A scanned code is only
 * useful for a minute, which is exactly the point.
 */
export function verifyGateCode(raw: string | null | undefined, at: number = Date.now()): boolean {
  const code = normalizeGateCode(raw)
  if (code.length !== GATE_CODE_LENGTH) return false
  const step = gateStep(at)
  for (let offset = 0; offset <= GATE_TOLERANCE_STEPS; offset += 1) {
    const expected = Buffer.from(codeForStep(step - offset))
    const given = Buffer.from(code)
    if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) return true
  }
  return false
}
