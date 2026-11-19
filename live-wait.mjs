import crypto from 'node:crypto'
import fs from 'node:fs'

for (const raw of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  const eq = line.indexOf('=')
  if (eq === -1) continue
  const key = line.slice(0, eq).trim()
  let value = line.slice(eq + 1).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
  if (!(key in process.env)) process.env[key] = value
}

const BASE = 'https://attend-ease-silk.vercel.app'
const body = Buffer.from(JSON.stringify({ userId: 'usr_boss', employeeId: 'emp_boss', role: 'admin', name: 'Hamza Sheikh', department: 'Management', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('base64url')
const cookie = `attendance_session=${body}.${sig}`

let ok = false
for (let attempt = 1; attempt <= 40; attempt += 1) {
  const html = await (await fetch(`${BASE}/boss/team`, { headers: { cookie } })).text()
  const ownerRow = /Hamza Sheikh[\s\S]{0,120}boss@demo\.com/.test(html)
  console.log(`attempt ${attempt}: ownerNameRendered=${ownerRow}`)
  if (ownerRow) { ok = true; break }
  await new Promise((r) => setTimeout(r, 15000))
}

const res = await fetch(`${BASE}/api/assistant`, {
  method: 'POST',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify({ question: 'who checked out today' }),
})
const json = await res.json()
console.log(`assistant: ${res.status} ${json.intent}`)
console.log(ok ? 'DEPLOY_OK' : 'DEPLOY_TIMEOUT')
process.exit(ok && json.intent === 'checked_out_today' ? 0 : 1)
