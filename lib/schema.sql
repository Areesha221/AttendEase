-- ============================================================
-- Attendance & Workforce Management Platform - Database Schema
-- SQLite (via Node's built-in node:sqlite)
-- Times are stored as Asia/Karachi (PKT, UTC+05:00) strings.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- Accounts & Roles ----------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('employee', 'boss')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

-- ---------- Employee Records ----------
CREATE TABLE IF NOT EXISTS employees (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT REFERENCES users(id) ON DELETE SET NULL,
  employee_code         TEXT NOT NULL UNIQUE,
  full_name             TEXT NOT NULL,
  cnic                  TEXT,
  phone                 TEXT,
  department            TEXT,
  job_title             TEXT,
  joining_date          TEXT,
  photo                 TEXT,               -- profile photo (data URI or file reference)
  status                TEXT NOT NULL DEFAULT 'active',  -- active | inactive
  monthly_salary        REAL NOT NULL DEFAULT 0,
  annual_leave_allowance INTEGER NOT NULL DEFAULT 20,
  carry_forward_leave   INTEGER NOT NULL DEFAULT 0,
  consent               INTEGER NOT NULL DEFAULT 0,      -- consent for photo/location/CNIC/attendance
  consent_at            TEXT,
  created_at            TEXT NOT NULL
);

-- ---------- Company / Attendance / Payroll Policy ----------
CREATE TABLE IF NOT EXISTS settings (
  id                      INTEGER PRIMARY KEY CHECK (id = 1),
  office_name             TEXT NOT NULL DEFAULT 'Head Office',
  office_lat              REAL NOT NULL,
  office_lng              REAL NOT NULL,
  radius_m                INTEGER NOT NULL DEFAULT 100,
  work_start              TEXT NOT NULL DEFAULT '09:00',
  work_end                TEXT NOT NULL DEFAULT '17:00',
  grace_minutes           INTEGER NOT NULL DEFAULT 15,
  required_hours          REAL NOT NULL DEFAULT 8,
  weekend_days            TEXT NOT NULL DEFAULT '0',     -- 0=Sunday ... 6=Saturday (Sunday-only weekend)
  work_days_per_month     INTEGER NOT NULL DEFAULT 26,
  late_penalty            REAL NOT NULL DEFAULT 200,
  absence_deduction_days  REAL NOT NULL DEFAULT 1,
  unpaid_leave_deduction_days REAL NOT NULL DEFAULT 1,
  perfect_attendance_bonus REAL NOT NULL DEFAULT 2000,
  no_late_bonus           REAL NOT NULL DEFAULT 1000,
  photo_retention_days    INTEGER NOT NULL DEFAULT 90,
  audit_retention_days    INTEGER NOT NULL DEFAULT 365,
  require_approval_for_deductions INTEGER NOT NULL DEFAULT 1,
  updated_at              TEXT NOT NULL
);

-- ---------- Attendance Events (one row per check-in / check-out) ----------
CREATE TABLE IF NOT EXISTS attendance (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL UNIQUE,   -- prevents duplicate uploads from offline queue
  employee_id     TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('check_in', 'check_out')),
  work_date       TEXT NOT NULL,          -- YYYY-MM-DD in Asia/Karachi
  server_time     TEXT NOT NULL,          -- server clock in PKT (authoritative)
  device_time     TEXT,                   -- device clock, kept for comparison
  photo           TEXT,                   -- selfie for this event
  latitude        REAL,
  longitude       REAL,
  accuracy_m      REAL,
  distance_m      REAL,
  location_status TEXT,                   -- inside | outside | unavailable
  sync_status     TEXT NOT NULL DEFAULT 'synced',   -- synced | pending
  verification    TEXT NOT NULL DEFAULT 'pending',  -- pending | verified | flagged
  review_status   TEXT NOT NULL DEFAULT 'not_required', -- not_required | pending | approved | rejected
  review_note     TEXT,                   -- boss note when approving / rejecting a flagged event
  reviewed_by     TEXT,                   -- name of the boss who reviewed it
  reviewed_at     TEXT,
  reason          TEXT,                   -- reason if record was manually corrected
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(work_date);

-- ---------- Leave Management ----------
CREATE TABLE IF NOT EXISTS leaves (
  id          TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,              -- annual | sick | casual | unpaid | emergency
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  days        REAL NOT NULL DEFAULT 1,
  reason      TEXT,
  attachment  TEXT,
  emergency   INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending', -- draft | submitted | pending | approved | rejected | cancelled
  approver_id TEXT,
  approved_at TEXT,
  comment     TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leaves_employee ON leaves(employee_id, start_date);

-- ---------- Public Holidays ----------
CREATE TABLE IF NOT EXISTS holidays (
  id    TEXT PRIMARY KEY,
  date  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL
);

-- ---------- Audit Log (every manual correction / policy change) ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  actor_id   TEXT,
  actor_name TEXT,
  action     TEXT NOT NULL,               -- create | update | delete | approve | reject | login
  entity     TEXT NOT NULL,               -- attendance | employee | settings | leave ...
  entity_id  TEXT,
  details    TEXT,
  created_at TEXT NOT NULL
);

-- ---------- Notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,                        -- NULL = broadcast to all bosses
  title      TEXT NOT NULL,
  body       TEXT,
  kind       TEXT NOT NULL DEFAULT 'info',-- info | success | warning | danger
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ============================================================
-- University / Career Guidance Module (demo dataset)
-- ============================================================

CREATE TABLE IF NOT EXISTS countries (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  code         TEXT NOT NULL,
  flag         TEXT,
  currency     TEXT,
  avg_tuition  REAL,                      -- average yearly tuition (local currency)
  living_cost  REAL,                      -- estimated yearly living cost
  intakes      TEXT,                      -- e.g. "Fall (Sep), Spring (Jan)"
  visa_note    TEXT,
  work_rights  TEXT,
  summary      TEXT
);

CREATE TABLE IF NOT EXISTS universities (
  id           TEXT PRIMARY KEY,
  country_id   TEXT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  city         TEXT,
  world_rank   TEXT,
  website      TEXT,
  tuition_min  REAL,
  tuition_max  REAL,
  currency     TEXT,
  scholarship  TEXT,
  description  TEXT
);

CREATE TABLE IF NOT EXISTS programs (
  id               TEXT PRIMARY KEY,
  university_id    TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  level            TEXT NOT NULL,          -- Bachelors | Masters | MBA | Diploma
  discipline       TEXT NOT NULL,          -- Computer Science | Business | Design ...
  duration_months  INTEGER NOT NULL DEFAULT 24,
  tuition_per_year REAL,
  currency         TEXT,
  intake           TEXT,                   -- Fall 2027 | Spring 2027 ...
  deadline         TEXT,                   -- YYYY-MM-DD (demo data)
  ielts_min        REAL,                   -- NULL = not required / flexible
  min_gpa          REAL,                   -- on 4.0 scale
  min_percentage   REAL,                   -- alternate requirement
  requirements     TEXT,                   -- JSON array of requirement strings
  scholarship_note TEXT,
  source_url       TEXT
);

CREATE INDEX IF NOT EXISTS idx_programs_university ON programs(university_id);
CREATE INDEX IF NOT EXISTS idx_programs_discipline ON programs(discipline);

-- ---------- Saved / shortlisted programs (career module) ----------
CREATE TABLE IF NOT EXISTS saved_programs (
  id           TEXT PRIMARY KEY,
  profile_name TEXT NOT NULL,
  program_id   TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  UNIQUE (profile_name, program_id)
);
