#!/usr/bin/env node
// ============================================================
// Set a strong random password for the boss (administrator) login.
//
// Usage (from attendance-app/):
//   npm run db:boss-password
//   npm run db:boss-password -- --email=boss@demo.com
//   npm run db:boss-password -- --password="My own strong password"
//
// The password is printed ONCE in this terminal. Save it in a password
// manager before closing the window. It is stored only as a bcrypt hash.
//
// Connection is read from TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
// (environment or .env.local). Without them, the local file database
// data/attendance.db is used.
// ============================================================

import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const argValue = (name) => {
  const prefix = `${name}=`
  const inline = args.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = args.indexOf(name)
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1]
  return undefined
}

function loadEnvLocal() {
  const file = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(file)) return
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}
loadEnvLocal()

const email = (argValue('--email') ?? 'boss@demo.com').trim().toLowerCase()
const customPassword = argValue('--password')
const url =
  argValue('--url') ??
  process.env.TURSO_DATABASE_URL ??
  `file:${path.join(process.cwd(), 'data', 'attendance.db').replace(/\\/g, '/')}`
const token = argValue('--token') ?? process.env.TURSO_AUTH_TOKEN
const isRemote = /^(libsql|https?|wss?):/i.test(url)

// 24 characters from a set without easily confused glyphs (0/O, 1/l/I).
// Always includes upper, lower, digit and symbol.
function generatePassword() {
  const groups = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%^&*_-+=?',
  ]
  const all = groups.join('')
  const pick = (set) => set[crypto.randomInt(set.length)]
  const chars = groups.map(pick)
  while (chars.length < 24) chars.push(pick(all))
  // Shuffle so the required groups are not in a predictable order.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

async function main() {
  const client = createClient({ url, authToken: isRemote ? token : undefined })

  try {
    const existing = await client.execute({
      sql: 'SELECT id, email, role FROM users WHERE lower(email) = ?',
      args: [email],
    })
    const user = existing.rows[0]
    if (!user) {
      console.error(`No login account found for ${email}.`)
      console.error('Run the migration first, or pass --email=<the boss email>.')
      process.exitCode = 1
      return
    }
    if (String(user.role) !== 'boss') {
      console.error(`${email} is not a boss account (role: ${user.role}). Refusing to change it.`)
      process.exitCode = 1
      return
    }

    const password = customPassword ?? generatePassword()
    const hash = bcrypt.hashSync(password, 12)
    await client.execute({
      sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
      args: [hash, String(user.id)],
    })

    console.log('')
    console.log('============================================================')
    console.log('  Boss password updated successfully')
    console.log('============================================================')
    console.log(`  Login email : ${user.email}`)
    console.log(`  Password    : ${password}`)
    console.log('============================================================')
    console.log('  Save this now — it is shown only once and stored hashed.')
    console.log('  You can change it later in the app: Profile → Change password.')
    console.log('')
  } finally {
    client.close()
  }
}

main().catch((error) => {
  console.error('Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
