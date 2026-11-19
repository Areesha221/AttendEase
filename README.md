# AttendEase — Attendance & Workforce Management

A mobile-first web app (installable PWA) for employee **attendance, leave, payroll and workforce
management**, plus a **study-abroad guidance** module (countries, universities, deadlines, required
documents and profile-based suggestions).

Built with **Next.js (App Router) + Turso (libSQL)**. It runs on Vercel with a persistent cloud
database, and locally against a plain SQLite file.

---

## ✨ Features

### Staff desk — four roles

The staff area (`/boss`) is one application with four levels of access. The role decides which menu
items exist and which server actions succeed; every page and action re-checks the role on the server.

| Capability | Admin | HR | Manager |
|---|:---:|:---:|:---:|
| Company dashboard (headcount, present/late/absent, live feed) | ✅ | ✅ | ✅ |
| Attendance monitor + review queue | ✅ | ✅ | ✅ |
| Leave approvals | ✅ | ✅ | ✅ |
| Attendance Q&A | ✅ | ✅ | ✅ |
| Add / edit / deactivate employees | ✅ | ✅ | — |
| Reset an employee password | ✅ | ✅ | — |
| Entrance gate screen + require-code switch | ✅ | ✅ | — |
| Company reports, payroll and CSV export | ✅ | — | ✅ |
| Create HR / manager staff accounts | ✅ | — | — |
| Permanently delete an employee | ✅ | — | — |

- **Admin** sees and can do everything, including **Staff accounts** (`/boss/team`).
- **HR** handles people: add/edit employees, attendance review, leave, gate and Q&A. Reports and staff
  accounts are blocked, not just hidden.
- **Manager** runs the company view: dashboard, attendance, leave approvals, reports and Q&A. Employee
  records, the gate and staff accounts are blocked.
- **Employee** only ever sees `/app` (self-service check-in/out, history, leave, profile).

Staff accounts are created by the admin from **Staff accounts → Add a staff account**. Deactivating an
account blocks sign-in immediately. Every create, activate, deactivate and password reset is written to
the audit log.

### Employee
- **Selfie check-in / check-out** with live camera capture. No separate biometric device is needed —
  the employee's own phone browser is the only hardware.
- **Rotating entrance code (QR)**: the office entrance screen shows a QR + 6-digit code that changes
  every 30 seconds. Employees scan it with their phone camera (or type the number); the server checks it
  against its own clock, so a screenshot or a code shared from home is useless. Optional per policy —
  when it is required, a capture without a valid code is flagged for review instead of verified.
- **Where the gate screen lives**: open `/boss/gate` on any spare tablet, laptop or phone and leave it
  on at the entrance. It needs mains power and internet (it fetches a fresh code every 30 seconds).
  The screen's own backlight works with the room lights off, but if the power or internet drops the
  rotating code stops — keep a charged phone with mobile data as a backup, or leave the code optional.
- **Anti-fraud checks**: every selfie gets a perceptual hash (dHash) compared with the employee's earlier
  captures — reusing the same photo is flagged — and two GPS fixes that would need impossible travel
  (over 250 km/h) between them are flagged too. Flags never block a check-in; they go to the staff desk.
- **GPS + office-radius verification** (inside/outside status, accuracy, distance, map link for staff).
- **Server time** always recorded in **Asia/Karachi (PKT)**, with late/early detection and a grace period.
- **Attendance history** with status badges (present / late / half-day / absent). Days **before the
  employee's joining date** are shown as “Before joining” and never counted as absence.
- **Leave request & leave balance** (casual, sick, earned) with an approval workflow.
- **My profile** (masked CNIC, department, salary, shift) with **change my own password**.

### Staff operations
- **Dashboard**: live headcount, present/late/absent today, pending leaves, offline events.
- **Employee management (HR + admin)**: add an employee (creates their login and joining date),
  edit details / salary / status / login, deactivate / reactivate. Permanent delete is admin-only.
- **Password administration**: reset any employee's password, and change your own from Profile.
- **Employees** directory (with a **Show inactive** toggle) + per-employee detail with photo review.
- **Leave approvals** (approve / reject with reason) that feed back into attendance.
- **Attendance review**: flagged events (selfie taken outside the office radius, synced late from the
  offline queue, carrying a GPS accuracy worse than ±150 m, reusing an earlier selfie, showing
  impossible travel, or missing/expired entrance code) can be approved or rejected with a note. Each
  card shows the exact coordinates as a Google Maps link, the reported accuracy, the distance from the
  office and any anti-fraud badges. Every decision is written to the audit log and the employee is
  notified.
- **Entrance gate screen** (`/boss/gate`): a full-screen rotating QR + code to leave on a tablet at the
  door, with a one-click switch that makes the entrance code mandatory for verified attendance.
- **Attendance Q&A** (`/boss/assistant`): a read-only, rule-based question desk for plain **English**
  questions — late arrivals, absences, check-outs, pending reviews and leave requests, one employee's
  month summary or leave balance, company and payroll totals, and the gate policy. It uses the same
  database queries as the dashboard (no external AI service, no writes), so the same question always
  gives the same answer.
- **Reports** (admin + manager) with payroll summary (deductions, bonuses, net pay) and **CSV export**.
- **Policy settings** (office location, radius, work hours, grace, working days, penalties).

### Study-abroad / Careers module
- **Discover**: countries, universities and programs with intakes, deadlines, tuition and scholarships.
- **Universities & programs**: detail pages with required documents and source links.
- **Suggestions**: a transparent, rule-based engine that scores programs against a student profile.
- **Shortlist**: save/unsave programs to a personal list.

### Platform
- **Installable PWA** (web app manifest + icons + install prompt).
- **Offline attendance**: events captured offline are queued on the device and synced automatically.
- **Security**: role-based access, hashed passwords (bcrypt), HMAC httpOnly session cookie, masked CNIC,
  and an **audit log** for every manual correction.

---

## 🧱 Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Icons / charts | lucide-react / recharts |
| Database | **Turso (libSQL)** in production; local SQLite file in development |
| DB client | `@libsql/client` (async) |
| Auth | Custom HMAC-signed httpOnly cookie session + `bcryptjs` |
| Hosting | Vercel (app) + Turso (database) |

---

## 🚀 Local development

> Requires **Node.js 20.9+** (Node 22 LTS or newer recommended).

```bash
cd attendance-app
npm install
npm run seed          # creates data/attendance.db with sample data (LOCAL ONLY)
npm run dev           # http://localhost:3000
```

Local development needs **no cloud account**: `lib/db.ts` automatically uses
`data/attendance.db` through the libSQL `file:` driver when `TURSO_DATABASE_URL` is not set.

> ⚠️ `npm run seed` **deletes and recreates the local database**. Never run it against Turso or a
> production database.

### Environment variables (local only)

Copy `.env.example` to `.env.local` when you need to override defaults:

```bash
cp .env.example .env.local
```

For local development you normally do **not** need to change anything.

---

## ☁️ Deploy: Turso + Vercel (step by step)

This guide assumes you have a GitHub account and have pushed this project to a repository.

### 1. Create the Turso database

1. Sign up at **https://turso.tech** (free tier is enough for a portfolio).
2. Install the Turso CLI, or use the dashboard to create a database.
3. Create a database (example name `attendance`):

   ```bash
   turso auth login
   turso db create attendance
   ```

4. Copy the **database URL**:

   ```bash
   turso db show attendance --url
   # libsql://attendance-yourname.turso.io
   ```

5. Create an **auth token** and copy it:

   ```bash
   turso db tokens create attendance
   ```

Keep both values private. Do not paste them into code, GitHub, or screenshots.

### 2. Configure the migration locally

Create `.env.local` in `attendance-app/` with:

```bash
TURSO_DATABASE_URL=libsql://attendance-yourname.turso.io
TURSO_AUTH_TOKEN=your-token-here
```

Your local `.env.local` is ignored by Git. Never commit it.

### 3. Copy your existing data to Turso

```bash
# Copy everything, then remove the demo employees
npm run db:migrate -- --clean-demo
```

The script:
- creates every table and index on Turso,
- copies all rows from `data/attendance.db`,
- with `--clean-demo`, deletes the demo employees (`ali@`, `ayesha@`, `bilal@`, `sana@demo.com`) and
  their attendance / leave / notification / audit rows,
- keeps your boss account and every real employee.

It is safe to run against an empty database. Run it **once** before going live; re-running later would
overwrite production rows with your local copy.

### 4. Optional: keep the dashboards populated

The demo employees own all of the seeded attendance, so `--clean-demo` leaves real employees with an
empty history. To add four weeks of believable sample attendance for the **remaining** employees
(tagged `sample-*`, never mixed with real records):

```bash
npm run db:sample
```

Re-running it replaces only the `sample-*` rows. Skip this step if you prefer a completely empty
history.

### 5. Set a strong boss password

```bash
npm run db:boss-password
```

This generates a random 24-character password, stores only its bcrypt hash, and prints the password
**once**. Save it in a password manager. You can change it later inside the app at
**Profile → Change password**.

To use your own password instead:

```bash
npm run db:boss-password -- --password="Your own strong password"
```

### 6. Create the session secret

Generate a long random value:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the output; it becomes `SESSION_SECRET`.

### 7. Import the project into Vercel

1. Push the project to GitHub.
2. Go to **https://vercel.com/new** and import the repository.
3. Leave **Root Directory** as `./` — `package.json` sits at the repository root. (Only set a
   subfolder here if you later move the app into one.)
4. Framework preset: **Next.js** (auto-detected).
5. Add these **Environment Variables** (Production, Preview and Development):

| Name | Value |
|---|---|
| `TURSO_DATABASE_URL` | your `libsql://…` URL |
| `TURSO_AUTH_TOKEN` | your Turso token |
| `SESSION_SECRET` | the long random string from step 6 |
| `GATE_SECRET` *(optional)* | a second long random string just for entrance codes; defaults to `SESSION_SECRET` |

6. Click **Deploy**.

The build command is `npm run build`; Vercel installs dependencies automatically. The SQL schema file
is bundled with the serverless functions (see `outputFileTracingIncludes` in `next.config.ts`), so the
app can create/migrate tables on first request.

### 8. Verify the deployment

1. Open the live URL.
2. Sign in with the boss email (`boss@demo.com` unless you changed it) and the password from step 5.
3. Check **Staff dashboard**, **Employees**, **Attendance monitor**, **Leave**, **Reports**, and **Staff accounts**.
4. Sign in as a real employee and open **Profile**, **Attendance history** and **Leave**.
5. Open `/api/health` — it should return `{"ok":true}` with the database reachable.

### 9. Change the boss email (optional, recommended)

`boss@demo.com` is only an email label, not a public password. If you prefer a personal address:

1. Sign in as boss.
2. Open **Employees** → the boss record (`BOSS-0001`) → **Edit details**.
3. Change the email and save.

Or update the row directly with Turso:
```sql
UPDATE users SET email = 'you@example.com' WHERE email = 'boss@demo.com';
```

---

## 📜 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server at http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Run the production build locally |
| `npm run seed` | **Local only:** wipe and recreate `data/attendance.db` with sample data |
| `npm run db:check` | Read-only inspect of the local database |
| `npm run db:migrate` | Copy the local database to Turso (`-- --clean-demo` removes demo employees) |
| `npm run db:boss-password` | Generate/set the boss password (printed once) |
| `npm run db:sample` | Replace the `sample-*` attendance rows with four weeks of realistic demo history |
| `npm run lint` | Run ESLint |

---

## 👥 Managing employees & passwords

Sign in as **admin** or **HR** and open **Employees** in the navigation. A manager does not see this
section and the server blocks it too.

| Task | How | Who |
|---|---|---|
| **Add a new employee** | Employees → **Add employee**. Creates both the employee record and a login account. | Admin, HR |
| **Edit / update** | Open the person → **Edit details**. Change salary, department, status, login email or password. | Admin, HR |
| **Deactivate (soft delete)** | On the employee page click **Deactivate account**. History is kept; sign-in is blocked. | Admin, HR |
| **Delete permanently** | **Delete permanently**, type `DELETE` to confirm. Removes the person, login, attendance and leave history. | Admin only |
| **Reset someone's password** | Use the **Reset password** card on their page. | Admin, HR |
| **Create HR / manager logins** | **Staff accounts** → **Add a staff account**. | Admin only |

> You can never deactivate or delete **your own** account.

---

## 🤖 Attendance Q&A (assistant)

Open **Q&A** in the staff navigation and type a normal English question. There is no external AI
provider: each question is matched to one built-in rule, then answered with the same read-only queries
the dashboard uses. The same question always produces the same numbers, and the Q&A desk cannot change
attendance, leave, payroll or settings. It is available to admin, HR and manager; employees get a clear
“staff accounts only” message.

| Ask (English) | What you get |
|---|---|
| `Who is late today?` / `Who was late yesterday?` | Check-ins after the grace period, with minutes late |
| `Who is absent today?` | Active team members with no check-in, leave or holiday |
| `Who checked out today?` | Check-outs with the matching check-in time |
| `Who has not checked out?` | People still clocked in |
| `Yesterday at a glance` | Present / late / absent / leave and check-in/out counts |
| `What needs my review?` | The attendance review queue with flag reasons |
| `Pending leave requests` | Requests waiting for a decision |
| `Top late employees this month` | Ranked late days (add `more than 2` to filter) |
| `Top absent employees this month` | Ranked absent days |
| `Overtime this month` | Employees with extra hours |
| `Perfect attendance this month` | No late day and no absence |
| `Summary for <employee> this month` | Present / late / absent / leave and averages |
| `Leave balance of <employee>` | Annual entitlement, used, pending and remaining |
| `Leave history of <employee>` | Every request in the year with status |
| `Payroll this month` | Company payroll estimate; add an employee name for one person |
| `Company summary this month` | Month-to-date on-time / late / absent / leave totals |
| `Office work hours` / `attendance policy` | Work hours, grace, radius, penalties and bonuses |
| `Is the gate code required?` | Current entrance-code policy |
| `Pending sync events` | Offline captures still waiting to upload |
| `Duplicate selfie flags` / `impossible travel` | Anti-fraud flags in the review queue |
| `Department headcount` | Active employees per department |
| `New joiners this month` | Employees whose joining date is in the month |
| `Inactive employees` | Deactivated accounts |

An unrecognised question returns a short “I did not understand” reply plus English example chips. The
admin's own employee record is excluded from team lists such as absence and late rankings. If the
server cannot read the data, the page shows a plain English error instead of a raw JSON parse failure.

---

## 🗄️ How the database works

- **Production:** `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` point at a managed libSQL database.
  Turso stores the data in the cloud, so it survives redeploys and serverless cold starts.
- **Local:** without those variables, `lib/db.ts` opens `data/attendance.db` with the libSQL `file:`
  driver. Same SQL, same schema, no server to install.
- **Schema:** `lib/schema.sql` is applied idempotently on first request. Older databases get missing
  columns through small, safe `ALTER TABLE` migrations in `lib/db.ts`.
- **Backups:** copy `data/attendance.db` for a local backup; use `turso db shell attendance .dump` for a
  cloud backup.
- **Never run `npm run seed` against Turso** — it drops and recreates the local file.

---

## 🗂️ Project structure

```
attendance-app/
├─ app/
│  ├─ page.tsx                 # Welcome / splash
│  ├─ login/                   # Login
│  ├─ app/                     # Employee area (home, check-in/out, attendance, leave, profile)
│  ├─ boss/                    # Staff area (dashboard, employees, leave, reports, staff accounts)
│  ├─ careers/                 # Study-abroad module
│  ├─ offline/                 # Offline fallback page
│  ├─ api/                     # attendance, health, reports CSV
│  ├─ manifest.ts              # PWA manifest
│  └─ layout.tsx               # Root layout
├─ components/                 # UI components
├─ lib/
│  ├─ db.ts / schema.sql       # libSQL client + schema
│  ├─ queries.ts               # data access for attendance, employees, payroll, reports
│  ├─ rules.ts / time.ts       # status + payroll math, Asia/Karachi helpers
│  ├─ session.ts / auth.ts     # session + role guards
│  ├─ employees.ts             # employee CRUD + password actions
│  ├─ offline-queue.ts         # localStorage queue for offline attendance
│  └─ careers.ts               # careers queries + suggestion engine
├─ scripts/
│  ├─ seed.mjs                 # local demo dataset (never run in production)
│  ├─ db-check.mjs             # read-only local inspector
│  ├─ migrate-to-turso.mjs     # local SQLite → Turso copier
│  ├─ set-boss-password.mjs    # one-time strong password generator
│  ├─ generate-sample-attendance.mjs # optional sample history for the remaining employees
│  └─ make-icons.mjs           # PWA icon generator
├─ public/
│  ├─ sw.js                    # service worker
│  └─ icons/
└─ proxy.ts                    # route protection
```

---

## 🔐 Security & privacy notes

- Passwords are hashed with **bcrypt**; sessions use an **HMAC-signed httpOnly cookie**.
- `SESSION_SECRET` must be set in production. A random value makes cookies unforgeable.
- Attendance integrity: server-authoritative time, server-computed distance, 64-bit selfie hashes,
  impossible-travel detection and (optionally) a rotating 30-second entrance code. A failed check never
  deletes a record — it queues it for staff review — so genuine employees are not silently punished.
- CNIC numbers are **masked** in the UI; photos are shown only to authorised roles.
- Every manual correction is written to an **audit log**.
- Login pages show **no demo credentials**: the app ships without demo hints, so the live site only
  exposes real accounts.
- Security headers are set in `next.config.ts`.
- Never commit `.env.local`, Turso tokens, or the generated boss password.

---

## ⚠️ Disclaimer

This is an educational / portfolio project. University deadlines, tuition figures and requirements are
sample data; each program keeps a `source_url` so real figures can be checked. Do not use it for real
payroll or admissions decisions without review.
