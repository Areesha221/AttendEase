// ============================================================
// Demo data seeder  ->  npm run seed
// Creates data/attendance.db from scratch with:
//   - 1 boss account + 4 employee accounts
//   - one month of realistic attendance (late / absent / leave / weekend)
//   - leave requests in every status, holidays, notifications, audit log
//   - university dataset: 6 countries / 20 universities / 40+ programs
//
// Demo logins (password shown for demo only):
//   boss@demo.com     / boss123       (Boss / Administrator)
//   ali@demo.com      / employee123   (Ali Raza)
//   ayesha@demo.com   / employee123   (Ayesha Khan)
//   bilal@demo.com    / employee123   (Bilal Ahmed)
//   sana@demo.com     / employee123   (Sana Malik)
// ============================================================

import { DatabaseSync } from 'node:sqlite'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const DB_PATH = process.env.ATTENDANCE_DB_PATH ?? path.join(root, 'data', 'attendance.db')
const SCHEMA_PATH = path.join(root, 'lib', 'schema.sql')

const TZ = 'Asia/Karachi'
const OFFICE = { name: 'Head Office - Faisalabad', lat: 31.4187, lng: 73.0791, radius: 100 }
const POLICY = {
  workStart: '09:00',
  workEnd: '17:00',
  graceMinutes: 15,
  requiredHours: 8,
  weekendDays: '0',
  workDaysPerMonth: 26,
  latePenalty: 200,
  absenceDeductionDays: 1,
  unpaidLeaveDeductionDays: 1,
  perfectAttendanceBonus: 2000,
  noLateBonus: 1000,
}

// ---------------- date helpers (Asia/Karachi) ----------------
function partsOf(date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const out = {}
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = part.value
  }
  out.hour = out.hour === '24' ? '00' : out.hour
  return out
}

function dateStr(date) {
  const p = partsOf(date)
  return `${p.year}-${p.month}-${p.day}`
}

function stamp(date) {
  const p = partsOf(date)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+05:00`
}

function shift(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

function weekdayOf(date) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function isWeekend(date) {
  return [0].includes(weekdayOf(date))
}

function clockFromMinutes(total) {
  const normalized = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

// ---------------- deterministic pseudo random ----------------
function hashString(text) {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function makeRandom(seedText) {
  let state = hashString(seedText) || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

// ---------------- placeholder photos (inline SVG) ----------------
function svgUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function initialsOf(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

function profilePhoto(name, hue) {
  const initials = initialsOf(name)
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 55%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 70% 40%)"/></linearGradient></defs><rect width="240" height="240" fill="url(#g)"/><text x="50%" y="53%" font-family="Segoe UI, Arial" font-size="92" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`,
  )
}

function selfiePhoto(name, workDate, clock) {
  const initials = initialsOf(name)
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="400"><defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs><rect width="320" height="400" fill="url(#b)"/><circle cx="160" cy="150" r="62" fill="#334155"/><text x="160" y="163" font-family="Segoe UI, Arial" font-size="42" font-weight="700" fill="#e2e8f0" text-anchor="middle">${initials}</text><rect x="60" y="240" width="200" height="34" rx="8" fill="#0ea5e9" opacity="0.18"/><text x="160" y="262" font-family="Segoe UI, Arial" font-size="15" fill="#7dd3fc" text-anchor="middle">LIVE SELFIE (demo)</text><text x="160" y="312" font-family="Segoe UI, Arial" font-size="17" fill="#e2e8f0" text-anchor="middle">${workDate}  ${clock}</text><text x="160" y="340" font-family="Segoe UI, Arial" font-size="13" fill="#94a3b8" text-anchor="middle">Asia/Karachi</text></svg>`,
  )
}

// ---------------- demo people ----------------
const boss = {
  id: 'usr_boss',
  email: 'boss@demo.com',
  password: 'boss123',
  role: 'boss',
  name: 'Hamza Sheikh',
  code: 'BOSS-0001',
  department: 'Management',
  jobTitle: 'Managing Director',
  phone: '0300-1234567',
  cnic: '42101-1234567-1',
  salary: 250000,
  hue: 210,
}

const employees = [
  {
    id: 'usr_ali',
    email: 'ali@demo.com',
    password: 'employee123',
    name: 'Ali Raza',
    code: 'EMP-1001',
    department: 'Web Development',
    jobTitle: 'Senior Web Developer',
    phone: '0301-1111111',
    cnic: '42101-2345678-3',
    salary: 60000,
    joining: '2024-03-01',
    allowance: 20,
    hue: 200,
  },
  {
    id: 'usr_ayesha',
    email: 'ayesha@demo.com',
    password: 'employee123',
    name: 'Ayesha Khan',
    code: 'EMP-1002',
    department: 'Design',
    jobTitle: 'UI/UX Designer',
    phone: '0302-2222222',
    cnic: '42101-3456789-5',
    salary: 75000,
    joining: '2024-07-15',
    allowance: 24,
    hue: 320,
  },
  {
    id: 'usr_bilal',
    email: 'bilal@demo.com',
    password: 'employee123',
    name: 'Bilal Ahmed',
    code: 'EMP-1003',
    department: 'Sales',
    jobTitle: 'Sales Executive',
    phone: '0303-3333333',
    cnic: '42101-4567890-7',
    salary: 50000,
    joining: '2025-01-06',
    allowance: 18,
    hue: 150,
  },
  {
    id: 'usr_sana',
    email: 'sana@demo.com',
    password: 'employee123',
    name: 'Sana Malik',
    code: 'EMP-1004',
    department: 'Human Resources',
    jobTitle: 'HR Officer',
    phone: '0304-4444444',
    cnic: '42101-5678901-9',
    salary: 65000,
    joining: '2025-05-19',
    allowance: 20,
    hue: 30,
  },
]

const holidays = [
  { date: '2026-11-09', name: 'Iqbal Day' },
  { date: '2026-12-25', name: 'Quaid-e-Azam Day' },
  { date: '2027-02-05', name: 'Kashmir Solidarity Day' },
  { date: '2027-03-23', name: 'Pakistan Day' },
]

const leaveRequests = [
  { employee: 'usr_ali', type: 'annual', start: '2026-11-05', end: '2026-11-07', days: 3, reason: 'Family wedding out of city', status: 'approved', approver: 'usr_boss', comment: 'Approved. Enjoy!', emergency: 0 },
  { employee: 'usr_ayesha', type: 'sick', start: '2026-11-10', end: '2026-11-11', days: 2, reason: 'Fever and flu, doctor advised rest', status: 'approved', approver: 'usr_boss', comment: 'Get well soon.', emergency: 0 },
  { employee: 'usr_bilal', type: 'casual', start: '2026-11-20', end: '2026-11-22', days: 2, reason: 'Personal errands', status: 'pending', approver: null, comment: null, emergency: 0 },
  { employee: 'usr_sana', type: 'annual', start: '2026-11-16', end: '2026-11-18', days: 3, reason: 'Short trip with family', status: 'rejected', approver: 'usr_boss', comment: 'Peak reporting week, please reschedule.', emergency: 0 },
  { employee: 'usr_ayesha', type: 'emergency', start: '2026-11-25', end: '2026-11-26', days: 2, reason: 'Family emergency at home town', status: 'submitted', approver: null, comment: null, emergency: 1 },
]

// ---------------- university dataset (demo) ----------------
const countries = [
  { id: 'c_uk', name: 'United Kingdom', code: 'UK', flag: '🇬🇧', currency: 'GBP', tuition: 18000, living: 12000, intakes: 'September, January', visa: 'Student Route visa — proof of funds, 20 hrs/week work allowed', work: '2-year Graduate Route after degree', summary: 'Strong research universities, 1-year Masters, January and September intakes.' },
  { id: 'c_us', name: 'United States', code: 'US', flag: '🇺🇸', currency: 'USD', tuition: 28000, living: 15000, intakes: 'Fall (Aug), Spring (Jan)', visa: 'F-1 visa — I-20, funding proof, interview required', work: 'OPT 12 months, 36 months for STEM', summary: 'Largest choice of universities and scholarships, requires strong profile and funds.' },
  { id: 'c_ca', name: 'Canada', code: 'CA', flag: '🇨🇦', currency: 'CAD', tuition: 20000, living: 13000, intakes: 'Fall, Winter, Summer', visa: 'Study permit + PAL, GIC account, SDS/Non-SDS', work: 'Post-Graduation Work Permit up to 3 years', summary: 'Popular for affordable diplomas, co-op programs and PR pathway.' },
  { id: 'c_au', name: 'Australia', code: 'AU', flag: '🇦🇺', currency: 'AUD', tuition: 32000, living: 21000, intakes: 'February, July', visa: 'Subclass 500 — GS statement, OSHC insurance', work: '48 hrs/fortnight, 2-4 year post-study work', summary: 'Good for Masters in IT, business and health; strong post-study work rights.' },
  { id: 'c_de', name: 'Germany', code: 'DE', flag: '🇩🇪', currency: 'EUR', tuition: 1500, living: 11500, intakes: 'Winter (Oct), Summer (Apr)', visa: 'Blocked account ~€11,904, APS certificate for Pakistani students', work: '18-month job seeker visa after graduation', summary: 'Low or no tuition at public universities; mostly English-taught Masters.' },
  { id: 'c_ae', name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪', currency: 'AED', tuition: 55000, living: 32000, intakes: 'September, January', visa: 'Student visa sponsored by university, medical test required', work: 'Part-time work with university permission', summary: 'Close to home, tax-free salaries, easy travel for Pakistani families.' },
]

const universities = [
  { id: 'u_manchester', country: 'c_uk', name: 'University of Manchester', city: 'Manchester', rank: 'Top 40 (QS)', site: 'https://www.manchester.ac.uk', tmin: 21000, tmax: 30000, cur: 'GBP', scholarship: 'Global Futures Scholarship up to £5,000' },
  { id: 'u_leeds', country: 'c_uk', name: 'University of Leeds', city: 'Leeds', rank: 'Top 100 (QS)', site: 'https://www.leeds.ac.uk', tmin: 20000, tmax: 27000, cur: 'GBP', scholarship: 'International Excellence Scholarship' },
  { id: 'u_coventry', country: 'c_uk', name: 'Coventry University', city: 'Coventry', rank: 'Top 600 (QS)', site: 'https://www.coventry.ac.uk', tmin: 15000, tmax: 19000, cur: 'GBP', scholarship: 'Vice-Chancellor Scholarship up to £3,000' },
  { id: 'u_glasgow', country: 'c_uk', name: 'University of Glasgow', city: 'Glasgow', rank: 'Top 80 (QS)', site: 'https://www.gla.ac.uk', tmin: 22000, tmax: 29000, cur: 'GBP', scholarship: 'Glasgow International Leadership Scholarship' },
  { id: 'u_asu', country: 'c_us', name: 'Arizona State University', city: 'Tempe, Arizona', rank: 'Top 200 (QS)', site: 'https://www.asu.edu', tmin: 26000, tmax: 34000, cur: 'USD', scholarship: 'New American University Scholarship' },
  { id: 'u_uta', country: 'c_us', name: 'University of Texas at Arlington', city: 'Arlington, Texas', rank: 'Top 700 (QS)', site: 'https://www.uta.edu', tmin: 21000, tmax: 28000, cur: 'USD', scholarship: 'Graduate Merit Scholarship' },
  { id: 'u_northeastern', country: 'c_us', name: 'Northeastern University', city: 'Boston, Massachusetts', rank: 'Top 350 (QS)', site: 'https://www.northeastern.edu', tmin: 32000, tmax: 45000, cur: 'USD', scholarship: 'Co-op based aid, merit scholarships' },
  { id: 'u_pace', country: 'c_us', name: 'Pace University', city: 'New York', rank: 'Top 900 (QS)', site: 'https://www.pace.edu', tmin: 24000, tmax: 33000, cur: 'USD', scholarship: 'International Student Scholarship up to 50%' },
  { id: 'u_toronto', country: 'c_ca', name: 'University of Toronto', city: 'Toronto', rank: 'Top 30 (QS)', site: 'https://www.utoronto.ca', tmin: 32000, tmax: 45000, cur: 'CAD', scholarship: 'Lester B. Pearson Scholarship (very competitive)' },
  { id: 'u_windsor', country: 'c_ca', name: 'University of Windsor', city: 'Windsor, Ontario', rank: 'Top 700 (QS)', site: 'https://www.uwindsor.ca', tmin: 18000, tmax: 26000, cur: 'CAD', scholarship: 'International Entrance Awards' },
  { id: 'u_conestoga', country: 'c_ca', name: 'Conestoga College', city: 'Kitchener, Ontario', rank: 'College', site: 'https://www.conestogac.on.ca', tmin: 15000, tmax: 19000, cur: 'CAD', scholarship: 'Limited, program based' },
  { id: 'u_seneca', country: 'c_ca', name: 'Seneca Polytechnic', city: 'Toronto, Ontario', rank: 'Polytechnic', site: 'https://www.senecapolytechnic.ca', tmin: 16000, tmax: 20000, cur: 'CAD', scholarship: 'Program based bursaries' },
  { id: 'u_deakin', country: 'c_au', name: 'Deakin University', city: 'Melbourne', rank: 'Top 250 (QS)', site: 'https://www.deakin.edu.au', tmin: 30000, tmax: 38000, cur: 'AUD', scholarship: 'Deakin International Scholarship 10-20%' },
  { id: 'u_wollongong', country: 'c_au', name: 'University of Wollongong', city: 'Wollongong', rank: 'Top 170 (QS)', site: 'https://www.uow.edu.au', tmin: 29000, tmax: 36000, cur: 'AUD', scholarship: 'UOW Country Scholarship up to 30%' },
  { id: 'u_rmit', country: 'c_au', name: 'RMIT University', city: 'Melbourne', rank: 'Top 130 (QS)', site: 'https://www.rmit.edu.au', tmin: 31000, tmax: 42000, cur: 'AUD', scholarship: 'RMIT International Excellence Scholarship' },
  { id: 'u_tum', country: 'c_de', name: 'Technical University of Munich', city: 'Munich', rank: 'Top 30 (QS)', site: 'https://www.tum.de', tmin: 0, tmax: 6000, cur: 'EUR', scholarship: 'DAAD scholarships, semester fee only' },
  { id: 'u_tuberlin', country: 'c_de', name: 'Technische Universität Berlin', city: 'Berlin', rank: 'Top 150 (QS)', site: 'https://www.tu.berlin', tmin: 0, tmax: 2000, cur: 'EUR', scholarship: 'DAAD, Erasmus Mundus' },
  { id: 'u_hbrs', country: 'c_de', name: 'Hochschule Bonn-Rhein-Sieg', city: 'Sankt Augustin', rank: 'Applied Sciences', site: 'https://www.h-brs.de', tmin: 0, tmax: 1500, cur: 'EUR', scholarship: 'No tuition fee, semester contribution only' },
  { id: 'u_sharjah', country: 'c_ae', name: 'University of Sharjah', city: 'Sharjah', rank: 'Top 450 (QS)', site: 'https://www.sharjah.ac.ae', tmin: 45000, tmax: 70000, cur: 'AED', scholarship: 'Merit based tuition waiver up to 50%' },
  { id: 'u_adb', country: 'c_ae', name: 'Abu Dhabi University', city: 'Abu Dhabi', rank: 'Top 600 (QS)', site: 'https://www.adu.ac.ae', tmin: 55000, tmax: 85000, cur: 'AED', scholarship: 'Chancellor Scholarship for top students' },
  // --- added breadth: medical, health, law, education, design, media, hospitality, agriculture ---
  { id: 'u_edinburgh', country: 'c_uk', name: 'University of Edinburgh', city: 'Edinburgh', rank: 'Top 30 (QS)', site: 'https://www.ed.ac.uk', tmin: 23000, tmax: 34000, cur: 'GBP', scholarship: 'Edinburgh Global Undergraduate Scholarship' },
  { id: 'u_buffalo', country: 'c_us', name: 'University at Buffalo (SUNY)', city: 'Buffalo, New York', rank: 'Top 400 (QS)', site: 'https://www.buffalo.edu', tmin: 25000, tmax: 33000, cur: 'USD', scholarship: 'International merit scholarships' },
  { id: 'u_mcgill', country: 'c_ca', name: 'McGill University', city: 'Montreal', rank: 'Top 30 (QS)', site: 'https://www.mcgill.ca', tmin: 30000, tmax: 46000, cur: 'CAD', scholarship: 'Entrance scholarships for international students' },
  { id: 'u_monash', country: 'c_au', name: 'Monash University', city: 'Melbourne', rank: 'Top 40 (QS)', site: 'https://www.monash.edu', tmin: 33000, tmax: 46000, cur: 'AUD', scholarship: 'Monash International Merit Scholarship' },
  { id: 'u_sydney', country: 'c_au', name: 'University of Sydney', city: 'Sydney', rank: 'Top 20 (QS)', site: 'https://www.sydney.edu.au', tmin: 38000, tmax: 50000, cur: 'AUD', scholarship: 'Sydney Scholars Award' },
  { id: 'u_heidelberg', country: 'c_de', name: 'Heidelberg University', city: 'Heidelberg', rank: 'Top 70 (QS)', site: 'https://www.uni-heidelberg.de', tmin: 0, tmax: 3000, cur: 'EUR', scholarship: 'No tuition fee; DAAD scholarships possible' },
  { id: 'u_gmu', country: 'c_ae', name: 'Gulf Medical University', city: 'Ajman', rank: 'Medical university', site: 'https://gmu.ac.ae', tmin: 55000, tmax: 95000, cur: 'AED', scholarship: 'Merit scholarships up to 40%' },
  { id: 'u_ajman', country: 'c_ae', name: 'Ajman University', city: 'Ajman', rank: 'Top 500 (QS)', site: 'https://www.ajman.ac.ae', tmin: 45000, tmax: 82000, cur: 'AED', scholarship: 'Merit-based tuition discounts' },
]

const programs = [
  // UK
  { uni: 'u_manchester', name: 'MSc Advanced Computer Science', level: 'Masters', discipline: 'Computer Science', months: 12, fee: 31000, cur: 'GBP', intake: 'September 2027', deadline: '2027-03-31', ielts: 6.5, gpa: 3.0, pct: 60, req: ['2:1 UK equivalent (60%+ / CGPA 3.0)', 'IELTS 6.5 with no band below 6.0', 'Personal statement + 2 references', 'CV with programming projects'], note: 'Global Futures Scholarship £5,000' },
  { uni: 'u_manchester', name: 'MSc Data Science', level: 'Masters', discipline: 'Data Science', months: 12, fee: 32000, cur: 'GBP', intake: 'September 2027', deadline: '2027-02-28', ielts: 6.5, gpa: 3.0, pct: 60, req: ['Quantitative degree (CS, Stats, Maths)', 'IELTS 6.5', 'Statement of purpose'], note: 'Competitive, early application advised' },
  { uni: 'u_leeds', name: 'MSc Artificial Intelligence', level: 'Masters', discipline: 'Computer Science', months: 12, fee: 27500, cur: 'GBP', intake: 'September 2027', deadline: '2027-04-30', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor in computing or related', 'IELTS 6.5 (6.0 each)', '2 references'], note: 'International Excellence Scholarship available' },
  { uni: 'u_leeds', name: 'MBA (Full time)', level: 'MBA', discipline: 'Business', months: 12, fee: 30000, cur: 'GBP', intake: 'September 2027', deadline: '2027-05-15', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor degree', '2 years work experience preferred', 'IELTS 6.5', 'GMAT optional'], note: 'Scholarships for women in business' },
  { uni: 'u_coventry', name: 'MSc Cyber Security', level: 'Masters', discipline: 'Cyber Security', months: 12, fee: 18500, cur: 'GBP', intake: 'January 2027', deadline: '2026-12-01', ielts: 6.5, gpa: 2.5, pct: 50, req: ['Bachelor in IT/CS or equivalent', 'IELTS 6.5', 'Statement of purpose'], note: 'Vice-Chancellor Scholarship up to £3,000' },
  { uni: 'u_coventry', name: 'BSc (Hons) Business Management', level: 'Bachelors', discipline: 'Business', months: 36, fee: 16500, cur: 'GBP', intake: 'January 2027', deadline: '2026-12-15', ielts: 6.0, gpa: 2.5, pct: 50, req: ['Intermediate / A-levels with 55%+', 'IELTS 6.0', 'Personal statement'], note: 'Foundation year available for lower grades' },
  { uni: 'u_glasgow', name: 'MSc Public Health', level: 'Masters', discipline: 'Public Health', months: 12, fee: 26500, cur: 'GBP', intake: 'September 2027', deadline: '2027-03-31', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Relevant bachelor (health, bio, social science)', 'IELTS 6.5', '2 references'], note: 'Leadership Scholarship available' },
  // USA
  { uni: 'u_asu', name: 'MS Computer Science', level: 'Masters', discipline: 'Computer Science', months: 24, fee: 30000, cur: 'USD', intake: 'Fall 2027', deadline: '2027-01-15', ielts: 6.5, gpa: 3.0, pct: 60, req: ['4-year bachelor in CS', 'GRE optional but recommended', 'TOEFL 80 / IELTS 6.5', 'SOP + 3 references'], note: 'New American University Scholarship for high GPA' },
  { uni: 'u_asu', name: 'MS Information Technology', level: 'Masters', discipline: 'Information Technology', months: 24, fee: 28000, cur: 'USD', intake: 'Spring 2027', deadline: '2026-12-01', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor degree', 'IELTS 6.5', 'Statement of purpose', 'Bank statement'], note: 'STEM OPT eligible' },
  { uni: 'u_uta', name: 'MS Data Analytics', level: 'Masters', discipline: 'Data Science', months: 24, fee: 24000, cur: 'USD', intake: 'Fall 2027', deadline: '2027-02-15', ielts: 6.5, gpa: 3.0, pct: 60, req: ['Bachelor with maths/stats background', 'IELTS 6.5', 'GRE waived for CGPA 3.0+'], note: 'Affordable tuition, assistantships possible' },
  { uni: 'u_northeastern', name: 'MS Information Systems (Co-op)', level: 'Masters', discipline: 'Information Technology', months: 24, fee: 42000, cur: 'USD', intake: 'Fall 2027', deadline: '2027-01-15', ielts: 7.0, gpa: 3.0, pct: 60, req: ['Bachelor degree', 'IELTS 7.0 / TOEFL 100', 'SOP + 2 references', 'Co-op track interview'], note: 'Paid co-op placements available' },
  { uni: 'u_pace', name: 'MS Computer Science', level: 'Masters', discipline: 'Computer Science', months: 24, fee: 27000, cur: 'USD', intake: 'Spring 2027', deadline: '2026-12-15', ielts: 6.5, gpa: 2.75, pct: 55, req: ['Bachelor in CS or bridge courses', 'IELTS 6.5', '2 references'], note: 'International scholarship up to 50%' },
  // Canada
  { uni: 'u_toronto', name: 'MSc Applied Computing', level: 'Masters', discipline: 'Computer Science', months: 16, fee: 42000, cur: 'CAD', intake: 'Fall 2027', deadline: '2027-01-10', ielts: 7.0, gpa: 3.3, pct: 70, req: ['Strong bachelor in CS', 'IELTS 7.0', '3 references', 'Research statement'], note: 'Very competitive, funding possible' },
  { uni: 'u_windsor', name: 'Master of Applied Computing', level: 'Masters', discipline: 'Computer Science', months: 16, fee: 22000, cur: 'CAD', intake: 'Fall 2027', deadline: '2027-02-01', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor in CS/IT', 'IELTS 6.5', 'SOP + 2 references', 'GIC for visa'], note: 'PGWP eligible, co-op option' },
  { uni: 'u_conestoga', name: 'PG Diploma in Business Analytics', level: 'Diploma', discipline: 'Business Analytics', months: 12, fee: 16500, cur: 'CAD', intake: 'Winter 2027', deadline: '2026-11-30', ielts: 6.5, gpa: 2.5, pct: 50, req: ['Bachelor or diploma', 'IELTS 6.5 (6.0 each)', 'GIC + first-year fees for SDS'], note: 'Very popular, seats fill fast' },
  { uni: 'u_conestoga', name: 'PG Diploma in Supply Chain Management', level: 'Diploma', discipline: 'Business', months: 12, fee: 15500, cur: 'CAD', intake: 'Spring 2027', deadline: '2027-01-31', ielts: 6.5, gpa: 2.5, pct: 50, req: ['Bachelor degree', 'IELTS 6.5', 'Statement of interest'], note: 'Co-op work term included' },
  { uni: 'u_seneca', name: 'PG Certificate in Project Management', level: 'Diploma', discipline: 'Business', months: 8, fee: 17000, cur: 'CAD', intake: 'Winter 2027', deadline: '2026-12-05', ielts: 6.5, gpa: 2.5, pct: 50, req: ['Bachelor degree', 'IELTS 6.5', 'Resume'], note: 'Short program, good for career switch' },
  // Australia
  { uni: 'u_deakin', name: 'Master of Data Science', level: 'Masters', discipline: 'Data Science', months: 18, fee: 36000, cur: 'AUD', intake: 'March 2027', deadline: '2027-01-31', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor with maths/IT component', 'IELTS 6.5 (6.0 each)', 'GS statement for visa'], note: 'Deakin International Scholarship 10-20%' },
  { uni: 'u_deakin', name: 'Master of Business Administration', level: 'MBA', discipline: 'Business', months: 18, fee: 39000, cur: 'AUD', intake: 'July 2027', deadline: '2027-05-31', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor degree', '2 years work experience', 'IELTS 6.5', 'Interview may be required'], note: 'Scholarships for early applicants' },
  { uni: 'u_wollongong', name: 'Master of Computer Science', level: 'Masters', discipline: 'Computer Science', months: 24, fee: 33000, cur: 'AUD', intake: 'February 2027', deadline: '2026-12-20', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor in CS/IT', 'IELTS 6.5', 'CV + SOP'], note: 'Country Scholarship up to 30%' },
  { uni: 'u_rmit', name: 'Master of Cyber Security', level: 'Masters', discipline: 'Cyber Security', months: 24, fee: 40000, cur: 'AUD', intake: 'July 2027', deadline: '2027-04-30', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor in IT or related', 'IELTS 6.5', 'GS statement'], note: 'Industry placement option' },
  // Germany
  { uni: 'u_tum', name: 'MSc Informatics', level: 'Masters', discipline: 'Computer Science', months: 24, fee: 300, cur: 'EUR', intake: 'Winter 2027', deadline: '2027-05-31', ielts: 6.5, gpa: 3.0, pct: 60, req: ['Bachelor in CS with strong maths', 'IELTS 6.5 or TOEFL 88', 'APS certificate', 'Motivation letter'], note: 'No tuition fee, only semester contribution' },
  { uni: 'u_tum', name: 'MSc Data Engineering and Analytics', level: 'Masters', discipline: 'Data Science', months: 24, fee: 300, cur: 'EUR', intake: 'Winter 2027', deadline: '2027-05-31', ielts: 6.5, gpa: 3.0, pct: 60, req: ['Bachelor in CS/Maths', 'IELTS 6.5', 'APS + uni-assist evaluation'], note: 'Highly competitive, no tuition fee' },
  { uni: 'u_tuberlin', name: 'MSc Computer Science (English taught)', level: 'Masters', discipline: 'Computer Science', months: 24, fee: 600, cur: 'EUR', intake: 'Winter 2027', deadline: '2027-04-30', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor in CS', 'IELTS 6.5', 'APS certificate', 'Letter of motivation'], note: 'Semester fee only, DAAD scholarships possible' },
  { uni: 'u_hbrs', name: 'MSc Autonomous Systems', level: 'Masters', discipline: 'Engineering', months: 24, fee: 900, cur: 'EUR', intake: 'Winter 2027', deadline: '2027-06-15', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor in electrical/mechanical/CS', 'IELTS 6.5', 'APS certificate'], note: 'Applied university, industry projects' },
  { uni: 'u_hbrs', name: 'MSc Business Administration (MBA)', level: 'MBA', discipline: 'Business', months: 24, fee: 1200, cur: 'EUR', intake: 'Summer 2027', deadline: '2027-02-28', ielts: 6.5, gpa: 2.5, pct: 50, req: ['Bachelor degree', '1 year work experience', 'IELTS 6.5'], note: 'Low fee, part-time work allowed' },
  // UAE
  { uni: 'u_sharjah', name: 'BSc Computer Science', level: 'Bachelors', discipline: 'Computer Science', months: 48, fee: 62000, cur: 'AED', intake: 'September 2027', deadline: '2027-07-15', ielts: 5.5, gpa: 2.5, pct: 50, req: ['Intermediate with 60%+', 'IELTS 5.5 or university test', 'Passport + photo'], note: 'Merit tuition waiver up to 50%' },
  { uni: 'u_sharjah', name: 'MBA Executive', level: 'MBA', discipline: 'Business', months: 24, fee: 78000, cur: 'AED', intake: 'January 2027', deadline: '2026-12-10', ielts: 6.0, gpa: 2.5, pct: 50, req: ['Bachelor degree', '2 years work experience', 'IELTS 6.0 or interview'], note: 'Evening/weekend classes for working professionals' },
  { uni: 'u_adb', name: 'MSc Cyber Security', level: 'Masters', discipline: 'Cyber Security', months: 18, fee: 80000, cur: 'AED', intake: 'January 2027', deadline: '2026-12-15', ielts: 6.0, gpa: 2.5, pct: 50, req: ['Bachelor in IT/CS', 'IELTS 6.0', 'CV + SOP'], note: 'Chancellor Scholarship for high achievers' },
  { uni: 'u_adb', name: 'BBA in Digital Marketing', level: 'Bachelors', discipline: 'Business', months: 48, fee: 65000, cur: 'AED', intake: 'September 2027', deadline: '2027-08-01', ielts: 5.5, gpa: 2.5, pct: 50, req: ['Intermediate 55%+', 'IELTS 5.5 or internal English test'], note: 'Internship placement support' },
  // Extra breadth: affordable Bachelors in UK / Masters in Canada
  { uni: 'u_coventry', name: 'BSc (Hons) Computer Science', level: 'Bachelors', discipline: 'Computer Science', months: 36, fee: 17500, cur: 'GBP', intake: 'September 2027', deadline: '2027-06-30', ielts: 6.0, gpa: 2.5, pct: 50, req: ['Intermediate/A-levels 55%+', 'IELTS 6.0', 'Personal statement'], note: 'Placement year option' },
  { uni: 'u_windsor', name: 'Master of Management', level: 'Masters', discipline: 'Business', months: 16, fee: 21000, cur: 'CAD', intake: 'Winter 2027', deadline: '2026-12-01', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor degree', 'IELTS 6.5', '2 references', 'Resume'], note: 'PGWP eligible' },
  { uni: 'u_leeds', name: 'MSc Engineering Management', level: 'Masters', discipline: 'Engineering', months: 12, fee: 26000, cur: 'GBP', intake: 'September 2027', deadline: '2027-04-30', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor in engineering', 'IELTS 6.5', 'SOP'], note: 'Scholarship available for Pakistani students' },
  { uni: 'u_asu', name: 'BS Computer Science', level: 'Bachelors', discipline: 'Computer Science', months: 48, fee: 32000, cur: 'USD', intake: 'Fall 2027', deadline: '2027-05-01', ielts: 6.0, gpa: 2.5, pct: 50, req: ['Intermediate/A-levels with good grades', 'IELTS 6.0 / TOEFL 61', 'Bank statement'], note: 'STEM OPT eligible' },
  { uni: 'u_deakin', name: 'Bachelor of Nursing', level: 'Bachelors', discipline: 'Nursing', months: 36, fee: 38000, cur: 'AUD', intake: 'March 2027', deadline: '2027-01-15', ielts: 7.0, gpa: 2.8, pct: 60, req: ['Intermediate/A-levels with science', 'IELTS 7.0 (7.0 each)', 'Health declaration'], note: 'High demand occupation, strong PR pathway' },
  { uni: 'u_rmit', name: 'Master of Engineering (Mechanical)', level: 'Masters', discipline: 'Engineering', months: 24, fee: 39000, cur: 'AUD', intake: 'February 2027', deadline: '2026-12-31', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor in mechanical engineering', 'IELTS 6.5', 'CV'], note: 'Accredited by Engineers Australia' },

  // ---- Medical & Health (MBBS / Medicine / Dentistry / Pharmacy / Physiotherapy / Nursing / Public Health) ----
  { uni: 'u_edinburgh', name: 'MBChB Medicine', level: 'Bachelors', discipline: 'Medicine', months: 60, fee: 34000, cur: 'GBP', intake: 'September 2027', deadline: '2026-10-15', ielts: 7.0, gpa: 3.5, pct: 75, req: ['Intermediate/A-levels with 3 science subjects, 75%+', 'UCAT aptitude test', 'IELTS 7.0 (7.0 each)', 'Interview + personal statement'], note: 'Very competitive; early UCAS deadline' },
  { uni: 'u_manchester', name: 'MBChB Medicine', level: 'Bachelors', discipline: 'Medicine', months: 60, fee: 31000, cur: 'GBP', intake: 'September 2027', deadline: '2026-10-15', ielts: 7.0, gpa: 3.4, pct: 70, req: ['Intermediate/A-levels with Biology and Chemistry, 70%+', 'UCAT required', 'IELTS 7.0 (6.5 each)', 'Interview'], note: 'Clinical placements from year 1' },
  { uni: 'u_glasgow', name: 'MBChB Medicine', level: 'Bachelors', discipline: 'Medicine', months: 60, fee: 29000, cur: 'GBP', intake: 'September 2027', deadline: '2026-10-15', ielts: 7.0, gpa: 3.3, pct: 70, req: ['Intermediate/A-levels with Chemistry and one more science, 70%+', 'UCAT required', 'IELTS 7.0', 'Interview + references'], note: 'Strong clinical reputation' },
  { uni: 'u_glasgow', name: 'BSc Nursing', level: 'Bachelors', discipline: 'Nursing', months: 36, fee: 24000, cur: 'GBP', intake: 'September 2027', deadline: '2027-01-15', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Intermediate/A-levels with a science subject', 'IELTS 6.5 (6.0 each)', 'Health declaration + police check'], note: 'NMC recognised, strong job demand' },
  { uni: 'u_edinburgh', name: 'LLB Law', level: 'Bachelors', discipline: 'Law', months: 48, fee: 25000, cur: 'GBP', intake: 'September 2027', deadline: '2027-01-15', ielts: 6.5, gpa: 3.0, pct: 65, req: ['Intermediate/A-levels 65%+', 'IELTS 6.5 (6.0 each)', 'Personal statement'], note: 'Scots law and common law pathways' },
  { uni: 'u_edinburgh', name: 'MSc Psychology', level: 'Masters', discipline: 'Psychology', months: 12, fee: 27000, cur: 'GBP', intake: 'September 2027', deadline: '2027-03-31', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor degree (any, psychology preferred)', 'IELTS 6.5', 'Personal statement', '2 references'], note: 'BPS accredited conversion option' },
  { uni: 'u_buffalo', name: 'BS Nursing', level: 'Bachelors', discipline: 'Nursing', months: 48, fee: 28000, cur: 'USD', intake: 'Fall 2027', deadline: '2027-02-01', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Intermediate/A-levels with Biology and Chemistry', 'IELTS 6.5 / TOEFL 79', 'Bank statement', 'Health clearance'], note: 'NCLEX preparation, STEM-adjacent' },
  { uni: 'u_buffalo', name: 'PharmD Pharmacy', level: 'Bachelors', discipline: 'Pharmacy', months: 72, fee: 30000, cur: 'USD', intake: 'Fall 2027', deadline: '2027-01-15', ielts: 6.5, gpa: 3.0, pct: 60, req: ['Pre-pharmacy science coursework', 'IELTS 6.5', 'PCAT optional', 'SOP + references'], note: 'Licensed pharmacist pathway' },
  { uni: 'u_asu', name: 'BS Nursing', level: 'Bachelors', discipline: 'Nursing', months: 48, fee: 31000, cur: 'USD', intake: 'Fall 2027', deadline: '2027-02-15', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Intermediate/A-levels with science', 'IELTS 6.5 / TOEFL 61', 'Bank statement'], note: 'STEM OPT eligible, high demand' },
  { uni: 'u_asu', name: 'BS Psychology', level: 'Bachelors', discipline: 'Psychology', months: 48, fee: 30000, cur: 'USD', intake: 'Fall 2027', deadline: '2027-04-01', ielts: 6.0, gpa: 2.5, pct: 50, req: ['Intermediate/A-levels with good grades', 'IELTS 6.0 / TOEFL 61', 'Bank statement'], note: 'Pathway to clinical or counselling masters' },
  { uni: 'u_northeastern', name: 'MS Public Health', level: 'Masters', discipline: 'Public Health', months: 18, fee: 38000, cur: 'USD', intake: 'Fall 2027', deadline: '2027-01-15', ielts: 6.5, gpa: 3.0, pct: 60, req: ['Bachelor degree (health or science preferred)', 'IELTS 6.5 / TOEFL 90', 'SOP + 2 references'], note: 'Co-op placements in health systems' },
  { uni: 'u_mcgill', name: 'BSc Nursing', level: 'Bachelors', discipline: 'Nursing', months: 36, fee: 34000, cur: 'CAD', intake: 'Fall 2027', deadline: '2027-01-15', ielts: 7.0, gpa: 3.0, pct: 65, req: ['Intermediate/A-levels with Biology and Chemistry 65%+', 'IELTS 7.0 (6.5 each)', 'French not required for this stream', 'Health declaration'], note: 'OIIQ licensure pathway' },
  { uni: 'u_mcgill', name: 'LLM Law', level: 'Masters', discipline: 'Law', months: 12, fee: 28000, cur: 'CAD', intake: 'Fall 2027', deadline: '2027-02-01', ielts: 6.5, gpa: 3.0, pct: 60, req: ['LLB or equivalent law degree', 'IELTS 6.5', 'Research statement', '2 references'], note: 'Common law and air & space law options' },
  { uni: 'u_mcgill', name: 'MEd Education', level: 'Masters', discipline: 'Education', months: 18, fee: 22000, cur: 'CAD', intake: 'Fall 2027', deadline: '2027-03-01', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor degree', 'IELTS 6.5', 'Statement of intent', '2 references'], note: 'Teaching, leadership and inclusive education' },
  { uni: 'u_toronto', name: 'MSc Public Health', level: 'Masters', discipline: 'Public Health', months: 16, fee: 40000, cur: 'CAD', intake: 'Fall 2027', deadline: '2027-01-10', ielts: 7.0, gpa: 3.3, pct: 70, req: ['Bachelor degree with strong grades', 'IELTS 7.0', '2 references', 'Statement of purpose'], note: 'Very competitive, epidemiology focus' },
  { uni: 'u_windsor', name: 'BSc Nursing', level: 'Bachelors', discipline: 'Nursing', months: 36, fee: 24000, cur: 'CAD', intake: 'Fall 2027', deadline: '2027-03-01', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Intermediate/A-levels with science', 'IELTS 6.5', 'Health declaration', 'Police check'], note: 'PGWP eligible, strong PR pathway' },
  { uni: 'u_monash', name: 'Bachelor of Medicine (MD)', level: 'Bachelors', discipline: 'Medicine', months: 60, fee: 45000, cur: 'AUD', intake: 'February 2027', deadline: '2026-11-30', ielts: 7.0, gpa: 3.4, pct: 70, req: ['Intermediate/A-levels with Chemistry, 70%+', 'UCAT ANZ test', 'IELTS 7.0 (7.0 each)', 'Multiple mini interviews'], note: 'Direct-entry medicine, very competitive' },
  { uni: 'u_monash', name: 'Bachelor of Pharmacy (Hons)', level: 'Bachelors', discipline: 'Pharmacy', months: 48, fee: 38000, cur: 'AUD', intake: 'February 2027', deadline: '2027-01-15', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Intermediate/A-levels with Chemistry', 'IELTS 6.5 (6.0 each)', 'GS statement'], note: 'Accredited, internship included' },
  { uni: 'u_monash', name: 'Master of Physiotherapy', level: 'Masters', discipline: 'Physiotherapy', months: 24, fee: 42000, cur: 'AUD', intake: 'July 2027', deadline: '2027-03-31', ielts: 7.0, gpa: 2.8, pct: 55, req: ['Bachelor with anatomy/physiology', 'IELTS 7.0 (6.5 each)', 'GS statement', 'Health declaration'], note: 'AHPRA registration pathway' },
  { uni: 'u_monash', name: 'Bachelor of Laws (Hons)', level: 'Bachelors', discipline: 'Law', months: 48, fee: 40000, cur: 'AUD', intake: 'February 2027', deadline: '2027-01-15', ielts: 6.5, gpa: 3.0, pct: 60, req: ['Intermediate/A-levels 60%+', 'IELTS 6.5 (6.0 each)', 'GS statement'], note: 'Qualifies for legal practice in Australia' },
  { uni: 'u_sydney', name: 'Master of Public Health', level: 'Masters', discipline: 'Public Health', months: 18, fee: 44000, cur: 'AUD', intake: 'March 2027', deadline: '2027-01-31', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor degree', 'IELTS 6.5 (6.0 each)', 'CV + statement'], note: 'Strong research and policy focus' },
  { uni: 'u_sydney', name: 'Bachelor of Nursing', level: 'Bachelors', discipline: 'Nursing', months: 36, fee: 41000, cur: 'AUD', intake: 'March 2027', deadline: '2027-01-15', ielts: 7.0, gpa: 2.8, pct: 60, req: ['Intermediate/A-levels with science', 'IELTS 7.0 (7.0 each)', 'Health declaration'], note: 'High demand occupation, strong PR pathway' },
  { uni: 'u_sydney', name: 'Master of Architecture', level: 'Masters', discipline: 'Architecture', months: 24, fee: 42000, cur: 'AUD', intake: 'March 2027', deadline: '2027-01-31', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor in architecture or design', 'IELTS 6.5', 'Portfolio', 'GS statement'], note: 'Accredited for registration' },
  { uni: 'u_deakin', name: 'Master of Public Health', level: 'Masters', discipline: 'Public Health', months: 18, fee: 34000, cur: 'AUD', intake: 'March 2027', deadline: '2027-01-31', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor degree', 'IELTS 6.5 (6.0 each)', 'GS statement'], note: 'Affordable, Deakin International Scholarship 10-20%' },
  { uni: 'u_deakin', name: 'Bachelor of Environmental Science', level: 'Bachelors', discipline: 'Agriculture', months: 36, fee: 33000, cur: 'AUD', intake: 'March 2027', deadline: '2027-01-31', ielts: 6.5, gpa: 2.5, pct: 50, req: ['Intermediate/A-levels with a science subject', 'IELTS 6.5 (6.0 each)', 'GS statement'], note: 'Field work and industry placements' },
  { uni: 'u_deakin', name: 'Bachelor of Design (Communication Design)', level: 'Bachelors', discipline: 'Design', months: 36, fee: 34000, cur: 'AUD', intake: 'March 2027', deadline: '2027-01-31', ielts: 6.5, gpa: 2.5, pct: 50, req: ['Intermediate/A-levels 50%+', 'IELTS 6.5', 'Portfolio (optional)'], note: 'Studio-based, industry projects' },
  { uni: 'u_wollongong', name: 'Bachelor of Nursing', level: 'Bachelors', discipline: 'Nursing', months: 36, fee: 32000, cur: 'AUD', intake: 'February 2027', deadline: '2026-12-20', ielts: 7.0, gpa: 2.8, pct: 60, req: ['Intermediate/A-levels with science', 'IELTS 7.0 (7.0 each)', 'Health declaration'], note: 'Regional campus, PR points advantage' },
  { uni: 'u_rmit', name: 'Bachelor of Pharmacy', level: 'Bachelors', discipline: 'Pharmacy', months: 48, fee: 38000, cur: 'AUD', intake: 'February 2027', deadline: '2027-01-31', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Intermediate/A-levels with Chemistry', 'IELTS 6.5', 'GS statement'], note: 'Industry placement included' },
  { uni: 'u_heidelberg', name: 'MSc Molecular Medicine', level: 'Masters', discipline: 'Medicine', months: 24, fee: 3000, cur: 'EUR', intake: 'Winter 2027', deadline: '2027-04-30', ielts: 6.5, gpa: 3.3, pct: 70, req: ['Bachelor in biology/medicine/biochemistry', 'IELTS 6.5 or TOEFL 90', 'APS certificate', 'Research motivation letter'], note: 'No tuition fee, research-heavy' },
  { uni: 'u_heidelberg', name: 'MSc Psychology', level: 'Masters', discipline: 'Psychology', months: 24, fee: 3000, cur: 'EUR', intake: 'Winter 2027', deadline: '2027-05-31', ielts: 6.5, gpa: 3.0, pct: 60, req: ['Bachelor in psychology', 'IELTS 6.5', 'APS certificate', 'Motivation letter'], note: 'Some modules taught in German' },
  { uni: 'u_tum', name: 'MSc Public Health', level: 'Masters', discipline: 'Public Health', months: 24, fee: 300, cur: 'EUR', intake: 'Winter 2027', deadline: '2027-05-31', ielts: 6.5, gpa: 3.0, pct: 60, req: ['Bachelor in health/sciences', 'IELTS 6.5 or TOEFL 88', 'APS certificate', 'Motivation letter'], note: 'No tuition fee, only semester contribution' },
  { uni: 'u_tuberlin', name: 'MSc Architecture', level: 'Masters', discipline: 'Architecture', months: 24, fee: 600, cur: 'EUR', intake: 'Winter 2027', deadline: '2027-04-30', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor in architecture', 'IELTS 6.5', 'Portfolio', 'APS certificate'], note: 'Semester fee only' },
  { uni: 'u_gmu', name: 'MBBS Medicine', level: 'Bachelors', discipline: 'Medicine', months: 72, fee: 95000, cur: 'AED', intake: 'September 2027', deadline: '2027-06-30', ielts: 6.0, gpa: 3.0, pct: 60, req: ['Intermediate with Biology, Chemistry, Physics 60%+', 'IELTS 6.0 or university English test', 'Entrance interview', 'Medical fitness + vaccination record'], note: 'Clinical training across Gulf hospitals' },
  { uni: 'u_gmu', name: 'BDS Dentistry', level: 'Bachelors', discipline: 'Dentistry', months: 60, fee: 92000, cur: 'AED', intake: 'September 2027', deadline: '2027-06-30', ielts: 6.0, gpa: 3.0, pct: 60, req: ['Intermediate with Biology and Chemistry 60%+', 'IELTS 6.0', 'Entrance interview', 'Medical fitness'], note: 'Simulation labs and clinical practice' },
  { uni: 'u_gmu', name: 'Doctor of Pharmacy (PharmD)', level: 'Bachelors', discipline: 'Pharmacy', months: 60, fee: 75000, cur: 'AED', intake: 'September 2027', deadline: '2027-07-15', ielts: 6.0, gpa: 2.8, pct: 55, req: ['Intermediate with Chemistry and Biology', 'IELTS 6.0', 'Interview'], note: 'Clinical pharmacy focus' },
  { uni: 'u_gmu', name: 'BSc Physiotherapy', level: 'Bachelors', discipline: 'Physiotherapy', months: 48, fee: 65000, cur: 'AED', intake: 'September 2027', deadline: '2027-07-15', ielts: 6.0, gpa: 2.5, pct: 50, req: ['Intermediate with Biology 50%+', 'IELTS 6.0', 'Interview'], note: 'Rehabilitation and sports therapy' },
  { uni: 'u_gmu', name: 'BSc Nursing', level: 'Bachelors', discipline: 'Nursing', months: 48, fee: 55000, cur: 'AED', intake: 'September 2027', deadline: '2027-07-31', ielts: 5.5, gpa: 2.5, pct: 50, req: ['Intermediate with science 50%+', 'IELTS 5.5 or university test', 'Interview'], note: 'Hospital partnerships across the UAE' },
  { uni: 'u_ajman', name: 'MBBS Medicine', level: 'Bachelors', discipline: 'Medicine', months: 72, fee: 82000, cur: 'AED', intake: 'September 2027', deadline: '2027-07-31', ielts: 6.0, gpa: 2.8, pct: 55, req: ['Intermediate with Biology and Chemistry 55%+', 'IELTS 6.0', 'Entrance test + interview'], note: 'Affordable medicine option close to home' },
  { uni: 'u_ajman', name: 'Bachelor of Law (LLB)', level: 'Bachelors', discipline: 'Law', months: 48, fee: 50000, cur: 'AED', intake: 'September 2027', deadline: '2027-08-01', ielts: 5.5, gpa: 2.5, pct: 50, req: ['Intermediate 50%+', 'IELTS 5.5 or university test', 'Passport + photo'], note: 'UAE and international law tracks' },
  { uni: 'u_sharjah', name: 'MBBS Medicine', level: 'Bachelors', discipline: 'Medicine', months: 72, fee: 88000, cur: 'AED', intake: 'September 2027', deadline: '2027-06-15', ielts: 6.5, gpa: 3.2, pct: 70, req: ['Intermediate with Biology, Chemistry, Physics 70%+', 'IELTS 6.5 or equivalent', 'Entrance interview', 'Medical fitness'], note: 'One of the strongest medical schools in the Gulf' },
  { uni: 'u_sharjah', name: 'BDS Dentistry', level: 'Bachelors', discipline: 'Dentistry', months: 60, fee: 85000, cur: 'AED', intake: 'September 2027', deadline: '2027-06-15', ielts: 6.0, gpa: 3.0, pct: 65, req: ['Intermediate with Biology and Chemistry 65%+', 'IELTS 6.0', 'Entrance interview'], note: 'Modern dental clinics on campus' },
  { uni: 'u_sharjah', name: 'Doctor of Pharmacy', level: 'Bachelors', discipline: 'Pharmacy', months: 60, fee: 70000, cur: 'AED', intake: 'September 2027', deadline: '2027-07-01', ielts: 6.0, gpa: 2.8, pct: 55, req: ['Intermediate with Chemistry and Biology', 'IELTS 6.0', 'Interview'], note: 'Merit tuition waiver up to 50%' },

  // ---- Law / Education / Media / Hospitality / Design breadth ----
  { uni: 'u_leeds', name: 'MA Education', level: 'Masters', discipline: 'Education', months: 12, fee: 22000, cur: 'GBP', intake: 'September 2027', deadline: '2027-05-31', ielts: 6.5, gpa: 2.8, pct: 55, req: ['Bachelor degree', 'IELTS 6.5', 'Personal statement', '2 references'], note: 'Leadership and inclusive education pathways' },
  { uni: 'u_coventry', name: 'BA (Hons) Journalism and Media', level: 'Bachelors', discipline: 'Media', months: 36, fee: 16500, cur: 'GBP', intake: 'September 2027', deadline: '2027-06-30', ielts: 6.0, gpa: 2.5, pct: 50, req: ['Intermediate/A-levels 50%+', 'IELTS 6.0', 'Personal statement'], note: 'Newsroom studio and placement options' },
  { uni: 'u_buffalo', name: 'JD Law', level: 'Masters', discipline: 'Law', months: 36, fee: 35000, cur: 'USD', intake: 'Fall 2027', deadline: '2027-03-01', ielts: 7.0, gpa: 3.0, pct: 60, req: ['Bachelor degree', 'LSAT recommended', 'IELTS 7.0 / TOEFL 100', 'Personal statement + 2 references'], note: 'US attorney qualification pathway' },
  { uni: 'u_buffalo', name: 'MArch Architecture', level: 'Masters', discipline: 'Architecture', months: 24, fee: 27000, cur: 'USD', intake: 'Fall 2027', deadline: '2027-01-15', ielts: 6.5, gpa: 3.0, pct: 60, req: ['Bachelor in architecture', 'IELTS 6.5', 'Portfolio', 'SOP'], note: 'NAAB accredited professional degree' },
  { uni: 'u_conestoga', name: 'PG Diploma in Hospitality and Tourism', level: 'Diploma', discipline: 'Hospitality', months: 12, fee: 15500, cur: 'CAD', intake: 'Spring 2027', deadline: '2027-01-31', ielts: 6.5, gpa: 2.5, pct: 50, req: ['Bachelor or diploma', 'IELTS 6.5 (6.0 each)', 'GIC + first-year fees for SDS'], note: 'Co-op work term, tourism sector demand' },
  { uni: 'u_asu', name: 'BS Graphic Design', level: 'Bachelors', discipline: 'Design', months: 48, fee: 30000, cur: 'USD', intake: 'Fall 2027', deadline: '2027-04-01', ielts: 6.0, gpa: 2.5, pct: 50, req: ['Intermediate/A-levels with good grades', 'IELTS 6.0 / TOEFL 61', 'Portfolio', 'Bank statement'], note: 'STEM-designated design technology track' },
  { uni: 'u_sharjah', name: 'BSc Environmental and Agricultural Science', level: 'Bachelors', discipline: 'Agriculture', months: 48, fee: 58000, cur: 'AED', intake: 'September 2027', deadline: '2027-07-15', ielts: 5.5, gpa: 2.5, pct: 50, req: ['Intermediate with a science subject 50%+', 'IELTS 5.5 or university test', 'Passport + photo'], note: 'Water, food security and sustainability focus' },
]

// ---------------- build database ----------------
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
if (fs.existsSync(DB_PATH)) fs.rmSync(DB_PATH)
for (const suffix of ['-wal', '-shm']) {
  const extra = `${DB_PATH}${suffix}`
  if (fs.existsSync(extra)) fs.rmSync(extra)
}

const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'))

const nowStamp = stamp(new Date())
const today = dateStr(new Date())
const holidaySet = new Set(holidays.map((holiday) => holiday.date))

db.prepare(
  `INSERT INTO settings (id, office_name, office_lat, office_lng, radius_m, work_start, work_end, grace_minutes,
     required_hours, weekend_days, work_days_per_month, late_penalty, absence_deduction_days, unpaid_leave_deduction_days,
     perfect_attendance_bonus, no_late_bonus, photo_retention_days, audit_retention_days, require_approval_for_deductions, updated_at)
   VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  OFFICE.name, OFFICE.lat, OFFICE.lng, OFFICE.radius,
  POLICY.workStart, POLICY.workEnd, POLICY.graceMinutes, POLICY.requiredHours,
  POLICY.weekendDays, POLICY.workDaysPerMonth, POLICY.latePenalty,
  POLICY.absenceDeductionDays, POLICY.unpaidLeaveDeductionDays,
  POLICY.perfectAttendanceBonus, POLICY.noLateBonus, 90, 365, 1, nowStamp,
)

const insertUser = db.prepare('INSERT INTO users (id, email, password_hash, role, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)')
const insertEmployee = db.prepare(
  `INSERT INTO employees (id, user_id, employee_code, full_name, cnic, phone, department, job_title, joining_date, photo,
     status, monthly_salary, annual_leave_allowance, carry_forward_leave, consent, consent_at, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 0, 1, ?, ?)`,
)

insertUser.run(boss.id, boss.email, bcrypt.hashSync(boss.password, 10), 'boss', nowStamp)
insertEmployee.run(
  'emp_boss', boss.id, boss.code, boss.name, boss.cnic, boss.phone, boss.department, boss.jobTitle,
  '2022-01-10', profilePhoto(boss.name, boss.hue), boss.salary, 30, nowStamp, nowStamp,
)

for (const person of employees) {
  insertUser.run(person.id, person.email, bcrypt.hashSync(person.password, 10), 'employee', nowStamp)
  insertEmployee.run(
    person.id, person.id, person.code, person.name, person.cnic, person.phone, person.department, person.jobTitle,
    person.joining, profilePhoto(person.name, person.hue), person.salary, person.allowance, nowStamp, nowStamp,
  )
}

// ---- leave requests ----
const insertLeave = db.prepare(
  `INSERT INTO leaves (id, employee_id, type, start_date, end_date, days, reason, attachment, emergency, status,
     approver_id, approved_at, comment, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
)
const leaveRangeByEmployee = new Map()
for (const [index, request] of leaveRequests.entries()) {
  const id = `leave_${index + 1}`
  const approvedAt = request.status === 'approved' || request.status === 'rejected' ? nowStamp : null
  insertLeave.run(
    id, request.employee, request.type, request.start, request.end, request.days, request.reason,
    request.emergency, request.status, request.approver, approvedAt, request.comment,
    stamp(new Date(Date.parse(`${shift(request.start, -4)}T10:20:00Z`))),
  )
  if (request.status === 'approved') {
    const existing = leaveRangeByEmployee.get(request.employee) ?? []
    existing.push({ start: request.start, end: request.end })
    leaveRangeByEmployee.set(request.employee, existing)
  }
}

function isOnApprovedLeave(employeeId, workDate) {
  const ranges = leaveRangeByEmployee.get(employeeId) ?? []
  return ranges.some((range) => workDate >= range.start && workDate <= range.end)
}

// ---- attendance history (last 30 days) ----
const insertAttendance = db.prepare(
  `INSERT INTO attendance (id, event_id, employee_id, type, work_date, server_time, device_time, photo, latitude, longitude,
     accuracy_m, distance_m, location_status, sync_status, verification, review_status, reason, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
)

let attendanceCount = 0
const absentTally = new Map()
const lateTally = new Map()

for (const person of employees) {
  absentTally.set(person.id, 0)
  lateTally.set(person.id, 0)

  for (let offset = 29; offset >= 0; offset -= 1) {
    const workDate = shift(today, -offset)
    if (isWeekend(workDate)) continue
    if (holidaySet.has(workDate)) continue
    if (isOnApprovedLeave(person.id, workDate)) continue

    const random = makeRandom(`${person.id}-${workDate}`)
    const roll = random()

    if (roll < 0.08) {
      absentTally.set(person.id, absentTally.get(person.id) + 1)
      continue
    }

    const isLate = roll < 0.33
    const inMinutes = isLate ? 9 * 60 + 16 + Math.floor(random() * 50) : 8 * 60 + 38 + Math.floor(random() * 36)
    const outMinutes = 17 * 60 + Math.floor(random() * 55) - (random() < 0.18 ? 35 : 0)

    const outsideOffice = random() < 0.07
    const spread = outsideOffice ? 0.004 + random() * 0.004 : (random() - 0.5) * 0.0012
    const latitude = Number((OFFICE.lat + spread).toFixed(6))
    const longitude = Number((OFFICE.lng + spread * 0.8).toFixed(6))
    const distance = distanceMeters(OFFICE.lat, OFFICE.lng, latitude, longitude)
    const locationStatus = distance <= OFFICE.radius ? 'inside' : 'outside'
    const accuracy = Math.round(8 + random() * 22)
    const isToday = workDate === today
    const pendingSync = person.id === 'usr_bilal' && offset <= 1
    const verification = locationStatus === 'outside' ? 'flagged' : 'verified'

    if (isLate) lateTally.set(person.id, lateTally.get(person.id) + 1)

    const inClock = clockFromMinutes(inMinutes)
    const inStampDate = new Date(Date.parse(`${workDate}T${inClock}:00Z`) - 5 * 3600 * 1000)
    insertAttendance.run(
      `att_in_${person.code}_${workDate}`, `${person.code}-${workDate}-in`, person.id, 'check_in', workDate,
      stamp(inStampDate), stamp(inStampDate), selfiePhoto(person.name, workDate, inClock),
      latitude, longitude, accuracy, distance, locationStatus, pendingSync ? 'pending' : 'synced', verification,
      verification === 'flagged' || pendingSync ? 'pending' : 'not_required', stamp(inStampDate),
    )
    attendanceCount += 1

    // Two employees deliberately have no check-out today (boss sees "not checked out")
    const skipCheckOut = isToday && ['usr_ali', 'usr_sana'].includes(person.id)
    if (skipCheckOut) continue

    const outClock = clockFromMinutes(outMinutes)
    const outStampDate = new Date(Date.parse(`${workDate}T${outClock}:00Z`) - 5 * 3600 * 1000)
    const outOutside = !outsideOffice && random() < 0.05
    const outSpread = outOutside ? 0.005 : spread
    const outLat = Number((OFFICE.lat + outSpread).toFixed(6))
    const outLng = Number((OFFICE.lng + outSpread * 0.8).toFixed(6))
    const outDistance = distanceMeters(OFFICE.lat, OFFICE.lng, outLat, outLng)
    const outVerification = outDistance <= OFFICE.radius ? 'verified' : 'flagged'
    insertAttendance.run(
      `att_out_${person.code}_${workDate}`, `${person.code}-${workDate}-out`, person.id, 'check_out', workDate,
      stamp(outStampDate), stamp(outStampDate), selfiePhoto(person.name, workDate, outClock),
      outLat, outLng, Math.round(9 + random() * 20), outDistance,
      outDistance <= OFFICE.radius ? 'inside' : 'outside', pendingSync ? 'pending' : 'synced',
      outVerification, outVerification === 'flagged' || pendingSync ? 'pending' : 'not_required', stamp(outStampDate),
    )
    attendanceCount += 1
  }
}

// ---- holidays, notifications, audit log ----
const insertHoliday = db.prepare('INSERT INTO holidays (id, date, name) VALUES (?, ?, ?)')
for (const [index, holiday] of holidays.entries()) {
  insertHoliday.run(`holiday_${index + 1}`, holiday.date, holiday.name)
}

const insertNotification = db.prepare(
  'INSERT INTO notifications (id, user_id, title, body, kind, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
)
insertNotification.run('note_1', null, 'New leave request', 'Ayesha Khan submitted an emergency leave request for 25–26 Nov 2026.', 'info', 0, nowStamp)
insertNotification.run('note_2', null, 'Leave pending approval', 'Bilal Ahmed has a casual leave request waiting for your decision.', 'warning', 0, nowStamp)
insertNotification.run('note_3', 'usr_ali', 'Attendance marked', 'Your check-in today was recorded on time. Have a good day!', 'success', 0, nowStamp)
insertNotification.run('note_4', 'usr_bilal', 'Sync pending', '1 offline attendance event is waiting to sync. Tap Sync now.', 'warning', 0, nowStamp)
insertNotification.run('note_5', 'usr_sana', 'Leave rejected', 'Your annual leave for 16–18 Nov was rejected. Reason: peak reporting week.', 'danger', 1, nowStamp)

const insertAudit = db.prepare(
  'INSERT INTO audit_logs (id, actor_id, actor_name, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
)
insertAudit.run('audit_1', boss.id, boss.name, 'update', 'attendance', `att_in_EMP-1003_${shift(today, -2)}`, 'Check-in time corrected from 09:48 to 09:12 after CCTV verification.', nowStamp)
insertAudit.run('audit_2', boss.id, boss.name, 'approve', 'leave', 'leave_1', 'Approved 3 days annual leave for Ali Raza (05–07 Nov 2026).', nowStamp)
insertAudit.run('audit_3', boss.id, boss.name, 'reject', 'leave', 'leave_4', 'Rejected annual leave for Sana Malik (16–18 Nov 2026).', nowStamp)
insertAudit.run('audit_4', boss.id, boss.name, 'update', 'settings', '1', 'Grace period set to 15 minutes; office radius set to 100 m.', nowStamp)

// ---- university module ----
const insertCountry = db.prepare(
  'INSERT INTO countries (id, name, code, flag, currency, avg_tuition, living_cost, intakes, visa_note, work_rights, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
)
for (const country of countries) {
  insertCountry.run(country.id, country.name, country.code, country.flag, country.currency, country.tuition, country.living, country.intakes, country.visa, country.work, country.summary)
}

const insertUniversity = db.prepare(
  'INSERT INTO universities (id, country_id, name, city, world_rank, website, tuition_min, tuition_max, currency, scholarship, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
)
for (const university of universities) {
  insertUniversity.run(university.id, university.country, university.name, university.city, university.rank, university.site, university.tmin, university.tmax, university.cur, university.scholarship, `${university.name} is located in ${university.city}. Ranking band: ${university.rank}. Tuition range ${university.tmin.toLocaleString()} – ${university.tmax.toLocaleString()} ${university.cur} per year (demo data).`)
}

const insertProgram = db.prepare(
  `INSERT INTO programs (id, university_id, name, level, discipline, duration_months, tuition_per_year, currency, intake, deadline,
     ielts_min, min_gpa, min_percentage, requirements, scholarship_note, source_url)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)
for (const [index, program] of programs.entries()) {
  const university = universities.find((item) => item.id === program.uni)
  insertProgram.run(
    `prog_${index + 1}`, program.uni, program.name, program.level, program.discipline, program.months,
    program.fee, program.cur, program.intake, program.deadline, program.ielts, program.gpa, program.pct,
    JSON.stringify(program.req), program.note, university?.site ?? null,
  )
}

db.close()

// ---------------- report ----------------
console.log('\nDemo database created successfully.\n')
console.log(`  File            : ${DB_PATH}`)
console.log(`  Accounts        : 1 boss + ${employees.length} employees`)
console.log(`  Attendance rows : ${attendanceCount}`)
console.log(`  Leave requests  : ${leaveRequests.length}`)
console.log(`  Countries       : ${countries.length}`)
console.log(`  Universities    : ${universities.length}`)
console.log(`  Programs        : ${programs.length}`)
console.log('\n  Late days this month:')
for (const person of employees) {
  console.log(`    ${person.code}  ${person.name.padEnd(14)} late: ${lateTally.get(person.id)}   absent: ${absentTally.get(person.id)}`)
}
console.log('\n  Logins:')
console.log('    boss@demo.com    / boss123       (Boss / Administrator)')
for (const person of employees) {
  console.log(`    ${person.email.padEnd(16)} / employee123   (${person.name})`)
}
console.log('')
