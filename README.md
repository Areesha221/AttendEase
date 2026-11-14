# AttendEase — Attendance & Workforce Management

A mobile-first web app (installable PWA) for employee **attendance, leave, payroll and workforce
management**, plus a **study-abroad guidance** module (countries, universities, deadlines, required
documents and profile-based suggestions).

Built as a college/demo project with **Next.js (App Router) + SQLite**. All data is local demo data;
no external services are required.

---

## ✨ Features

### Employee
- **Selfie check-in / check-out** with live camera capture.
- **GPS + office-radius verification** (inside/outside status, accuracy, distance).
- **Server time** always recorded in **Asia/Karachi (PKT)**, with late/early detection and a grace period.
- **Attendance history** with status badges (present / late / half-day / absent). Days **before the
  employee's joining date** are shown as “Before joining” and never counted as absence.
- **Leave request & leave balance** (casual, sick, earned) with an approval workflow.
- **My profile** (masked CNIC, department, salary, shift) with **change my own password**.

### Boss / Administrator
- **Dashboard**: live headcount, present/late/absent today, pending leaves, offline events.
- **Employee management (full CRUD)**: **add** a new employee (creates their login, with a **joining
  date**), **edit/update** details, salary, status and login, **deactivate / reactivate**, and
  **permanently delete** a record. Attendance, late fines and absence deductions start from the
  joining date.
- **Password administration**: reset any employee's password, and **change your own** from the
  **Profile** page in the top navigation.
- **Employees** directory (with a **Show inactive** toggle) + per-employee detail with photo review.
- **Leave approvals** (approve / reject with reason) that feed back into attendance.
- **Attendance review**: flagged events (selfie taken outside the office radius) can be **approved or
  rejected** with a note. Every decision is written to the audit log and the employee is notified.
- **Reports** with payroll summary (deductions, bonuses, net pay) and **CSV export**.
- **Policy settings** (office location, radius, work hours, grace, working days, penalties).
  The weekend is **Sunday only** — Saturday is a normal working day.

### Study-abroad / Careers module
- **Discover**: 6 countries, 28 universities, 85 programs with intakes, deadlines, tuition and scholarships.
- **Universities & programs**: detail pages with required documents and source links.
- **Suggestions**: a transparent, rule-based engine that scores programs against a student profile
  (subject, level, country, budget, IELTS, grades, deadline urgency).
- **Shortlist**: save/unsave programs to a personal list.

### Platform
- **Installable PWA** (web app manifest + icons + install prompt).
- **Offline attendance**: events captured offline are queued on the device and synced automatically.
- **Service worker** caches the app shell so the app opens without a connection.
- **Security**: role-based access, hashed passwords (bcrypt), HMAC httpOnly session cookie, masked CNIC,
  and an **audit log** for every manual correction.
- **Show / hide passwords**: every password field has an eye toggle so you can check what you typed.

---

## 🧱 Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Icons / charts | lucide-react / recharts |
| Database | SQLite via Node's built-in `node:sqlite` (no ORM, no server) |
| Auth | Custom HMAC-signed httpOnly cookie session + `bcryptjs` |
| PWA | `app/manifest.ts`, `public/sw.js`, `components/pwa-manager.tsx` |

---

## 🚀 Getting started

> Requires **Node.js 22.5+** (for `node:sqlite`) — Node 24 LTS recommended.

```bash
cd attendance-app
npm install          # install dependencies
npm run seed         # create + seed the SQLite database (data/attendance.db)
npm run dev          # start the dev server
```

Open **http://localhost:3000**.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Boss / Administrator | `boss@demo.com` | `boss123` |
| Employee (Ali Raza) | `ali@demo.com` | `employee123` |
| Employee (Ayesha Khan) | `ayesha@demo.com` | `employee123` |
| Employee (Bilal Ahmed) | `bilal@demo.com` | `employee123` |
| Employee (Sana Malik) | `sana@demo.com` | `employee123` |

The login screen also has one-tap **Fill** buttons for each demo account.

### Hiding the demo hints (before a real demo / presentation)

The welcome page and the login screen show the demo credentials. To hide them:

1. Create a file named `.env.local` inside `attendance-app/` containing:
   ```bash
   NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=false
   ```
2. Rebuild the app: `npm run build` (then `npm run start`).

To show them again, set it to `true` (or delete `.env.local`) and rebuild. The value is baked in at
build time, so a rebuild is required after changing it. A ready-made `.env.example` is included.

---

## 📜 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server at http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Run the production build (needed to test the service worker offline) |
| `npm run seed` | (Re)create and seed the SQLite database |
| `npm run db:reset` | Same as `seed` — wipes and rebuilds the demo data |
| `npm run db:check` | Print table row counts, login accounts, employees and the latest audit log |
| `npm run lint` | Run ESLint |

---

## 👥 Managing employees & passwords (boss)

Sign in as the boss (`boss@demo.com` / `boss123`) and open **Employees** in the top navigation.

| Task | How |
|---|---|
| **Add a new employee** | Employees → **Add employee**. Fill in name, email, a starting password, code, department, job title, joining date and salary. This creates **both** the employee record **and** a login account for them. |
| **Edit / update an employee** | Employees → open the person → **Edit details**, or use the **Edit** link on their card. Change any field (salary, department, status, even the login email/password) and save. |
| **Deactivate (soft delete)** | On the employee's page click **Deactivate account**. They keep all history but can no longer sign in. Turn on **Show inactive** in the list to find them again, then **Reactivate account**. |
| **Delete permanently (hard delete)** | On the employee's page click **Delete permanently**, type `DELETE` to confirm, then **Permanently delete**. This removes the person, their login and their attendance/leave history — it cannot be undone. |
| **Reset someone's password** | On the employee's page use the **Reset password** card and set a new one. |

> You can never deactivate or delete **your own** boss account from these screens (a safety guard).

**Employees changing their own password:** an employee signs in, opens **Profile**, and uses the
**Change password** card (they must enter their current password first).

---

## 🗄️ Is the data really saved? (checking the database)

Yes — every change is written to a real **SQLite** file at **`attendance-app/data/attendance.db`**.
Passwords are stored **hashed** (bcrypt), not as plain text.

To prove it, run this any time (stop the dev server first, because the file is locked while it runs):

```bash
npm run db:check
```

It prints:

- every table and its **row count**,
- the **login accounts** (`users`),
- the **employees** (code, name, department, status, salary),
- the **most recent audit-log entries** (who did what and when).

Do something in the app (add an employee, approve leave, change a password), run `npm run db:check`
again, and you will see the row counts and the audit log grow — that is your proof the data persisted.

### How SQLite works here (no connection string needed)

- **SQLite is a single file.** The entire database — every table and every row — lives in
  `attendance-app/data/attendance.db`. Copy that one file and you have a full backup.
- **There is no database server and no connection string.** Unlike MySQL/Postgres, nothing runs in the
  background. The app opens the file directly with Node's built-in `node:sqlite` driver (`lib/db.ts`),
  runs normal SQL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) and the changes are saved to the file.
- **The tables are defined in `lib/schema.sql`.** `npm run seed` drops the file, recreates the tables
  from that schema and fills the demo rows.
- **To change data:** use the app screens (recommended). For bulk edits you can run SQL against the
  file with any SQLite viewer (e.g. "DB Browser for SQLite") or a small Node script.
- **To add a column:** update `lib/schema.sql` **and** add the matching idempotent
  `ALTER TABLE ... ADD COLUMN ...` to `openDatabase()` in `lib/db.ts`. The app checks the existing
  columns on every start and only adds the missing ones, so your current data is kept. (Re-seeding with
  `npm run seed` would give a fresh demo database, but ⚠️ it wipes all existing data.)
- **To change the weekend:** the policy lives in the `settings` table (`weekend_days`). `'0'` means
  Sunday only (current). `'0,6'` would make Saturday a weekend too. Change it in the app settings table
  (or with a SQLite viewer); no rebuild is needed because the app reads it on every request.

---

## 🗂️ Project structure

```
attendance-app/
├─ app/
│  ├─ page.tsx                 # Welcome / splash
│  ├─ login/                   # Login (role switch + demo fill buttons)
│  ├─ app/                     # Employee area (home, check-in/out, attendance, leave, profile)
│  ├─ boss/                    # Boss area (dashboard, employees, leave, reports)
│  ├─ careers/                 # Study-abroad module (discover, universities, programs, suggestions, saved)
│  ├─ offline/                 # Offline fallback page (served by the service worker)
│  ├─ api/                     # attendance, health, reports CSV
│  ├─ manifest.ts              # PWA manifest
│  └─ layout.tsx               # Root layout (mounts <PwaManager />)
├─ components/                 # UI: navs, selfie capture, offline banner, PWA manager, cards…
├─ lib/
│  ├─ db.ts / schema.sql       # node:sqlite connection + 16-table schema
│  ├─ queries.ts               # data access for attendance, employees, payroll, reports
│  ├─ rules.ts / time.ts       # status + payroll math, Asia/Karachi helpers
│  ├─ session.ts / auth.ts     # session + role guards (requireBoss / requireEmployee)
│  ├─ employees.ts             # employee CRUD + password server actions (boss + self)
│  ├─ employee-shared.ts       # shared form validation + state types (client-safe)
│  ├─ demo-config.ts           # show/hide demo login hints (NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS)
│  ├─ offline-queue.ts         # localStorage queue for offline attendance
│  └─ careers.ts               # careers queries + suggestion engine
├─ scripts/
│  ├─ seed.mjs                 # demo dataset + seed (countries/universities/programs + staff data)
│  ├─ db-check.mjs             # read-only database inspector (npm run db:check)
│  └─ make-icons.mjs           # generates the PWA icons
├─ public/
│  ├─ sw.js                    # service worker (offline app shell)
│  └─ icons/                   # 192 / 512 / maskable icons
└─ proxy.ts                    # route protection (gates /app, /boss, /careers)
```

---

## 📲 PWA & offline notes

- **Install:** the app has a manifest (`/manifest.webmanifest`) and icons, so browsers offer an install
  prompt. Chrome/Edge use the `beforeinstallprompt` event (custom **Install** button); iOS Safari shows
  manual “Add to Home Screen” instructions.
- **Service worker** (`public/sw.js`) is registered **only in production builds**. Test offline with:
  ```bash
  npm run build
  npm run start
  ```
  Then load the app once, go offline (DevTools → Network → Offline), and reload — the shell opens and
  the `/offline` fallback appears for pages that were not cached. `next dev` deliberately does **not**
  register the worker so cached chunks can never go stale during development.
- **Offline attendance** works independently of the service worker: check-in/out events are stored in
  `localStorage` (`lib/offline-queue.ts`) and flushed to `/api/attendance` when the device reconnects.
  The server de-duplicates on `eventId`, so a retry is always safe. If an event is synced late (more
  than 10 minutes after capture, up to 7 days), the original **device date/time** is used so it lands
  on the correct day, and it is put in the boss **review queue**.
- **What happens to “pending” events:** they wait **on the phone**, not on the server. When the network
  returns (or the employee taps **Sync now**), the queue is posted and each event is checked by the
  server (duplicate? selfie present? already checked in/out?). Accepted events are saved as `synced`;
  rejected ones stay queued with a short reason. A normal offline check-in does **not** need a separate
  boss approval — the validation rules accept it.
- **Boss review of flagged events:** if the selfie was captured outside the office radius, the event is
  saved as `flagged` and appears in **Attendance monitor → Awaiting review**. Events synced from the
  offline queue are also placed in this queue. The boss can **Approve** (it counts) or **Reject** (it
  does not count, and is ignored by attendance and payroll), with an optional note. The decision,
  reviewer and timestamp are stored on the row, written to the audit log, exported in the CSV, and the
  employee receives a notification. Use **Show all dates** to review events from previous days.
- **Automatic retry:** `experimental.useOffline` is enabled, so blocked navigation, prefetch and Server
  Action requests retry automatically when connectivity returns.

---

## 🔐 Security & privacy notes

- Passwords are hashed with **bcrypt**; sessions use an **HMAC-signed httpOnly cookie**.
- CNIC numbers are **masked** in the UI; photographs are stored privately and shown only to authorised roles.
- Every manual correction is written to an **audit log**.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) are set in `next.config.ts`.

---

## ⚠️ Disclaimer

This is a **demo / educational project**. The university deadlines, tuition figures, requirements and
employee records are **sample data**; each program keeps a `source_url` so the real, current figures can
be verified on the university website. Do not use it for real payroll or admissions decisions.
