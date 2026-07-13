# ESG Astraa — HRMS & Attendance Portal
## Complete Project Documentation

> Internal reference for the ESG Astraa HRMS. Covers what the system is, how it's
> built, where every piece of data lives, how it's secured, how it's backed up,
> and how to operate it. **Contains no passwords or secret keys** — it only says
> *where* those live.

- **Live app:** https://esg-astraa-hrms.vercel.app
- **Type:** Responsive web app + installable Android APK (one codebase)
- **Audience:** ESG Astraa employees, managers, and admin/HR
- **Last updated:** July 2026

---

## 1. What the system is

An internal **HR management + attendance** platform that replaces manual tracking.
From one codebase it ships as:

1. A **responsive web app** (desktop + mobile browser), and
2. An **Android APK** (installable) built by wrapping the same app.

### Core capabilities
- **Geofenced attendance** (check-in/out with GPS + office radius)
- **Employee profiles & onboarding** (with documents)
- **Daily tasks + proof-of-work** (editable, with full version history)
- **90-day / 30-day task plans**
- **Performance evaluations** (private ratings by admin/manager)
- **Team meetings** (schedule + invite + join link)
- **Leave requests** (route to admin/manager, approvals, calendar)
- **Team chat** (global, department, and 1-to-1 direct messages, with files/emoji)
- **Notifications** (in-app bell + email)
- **Analytics** (attendance breakdown, weekly hours, evaluation trends)
- **Admin console** (directory, attendance, tasks, evaluation, leave, chat moderation)

### Roles
- **Employee** — marks attendance, maintains profile, logs daily tasks + proof,
  requests leave, chats, joins meetings.
- **Manager** — everything an employee does **plus** manages their **department**:
  views team attendance/tasks/plans, evaluates team members, reviews their
  department's leave requests, schedules department meetings, department chat.
- **Admin (HR/founder)** — superuser: full directory, all attendance, all tasks,
  evaluates managers, reviews all leave, schedules any meeting, chat moderation,
  editable employee IDs, promotes employees to managers.

---

## 2. Technology stack (what & why)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router, TypeScript strict)** | One codebase serves web + is wrapped for the APK; server components + middleware for auth; fast SPA-like navigation |
| Native wrapper | **Capacitor** | Wraps the deployed web app into an Android APK; bridges native Camera + Geolocation |
| Database / Auth / Storage / Realtime | **Supabase** (Postgres) | Single managed backend: Postgres DB, email/password + Google auth, file storage, realtime for chat/notifications, and Row-Level Security |
| Styling | **Tailwind CSS** | Utility-first, matches the brand tokens |
| Data fetching / cache | **@supabase/supabase-js** + **React Query** | Caches attendance/task data, avoids refetch on every navigation |
| Forms | **react-hook-form + zod** | Multi-step onboarding + validation |
| Charts | **Custom SVG/CSS** (no chart library) | Lightweight line/bar charts; no heavy dependency |
| Icons | **lucide-react** | Consistent icon set |
| Email | **Nodemailer + Gmail SMTP** | Sends notification/invite emails from server routes |
| Hosting (web) | **Vercel** | Auto-deploys from GitHub `main` |
| Source control | **GitHub** (`namrataesgastraa/HRMS`) | Versioned code + CI (backups) |
| Backups | **GitHub Actions + rclone** | Nightly DB dump + storage → GitHub artifact + Google Drive |

**Deliberately NOT used:** Firebase (this project standardises on Supabase).

### Brand tokens
- Dark base `#232234`, Electric violet `#7516EA`, Cool blue `#2E94F3`, Success `#22C55E`
- Primary gradient: `linear-gradient(135deg, #7516EA → #2E94F3)`
- Typography: **Raleway**
- Icon/branding: ESG Astraa butterfly mark (favicon + app icon), wordmark in-app

---

## 3. Architecture — how it works

### 3.1 Web + APK from one codebase
- The **web app** is deployed on Vercel (SSR + middleware + API routes).
- The **APK** is built with Capacitor and loads the **hosted web URL** (not a static
  export), so it always runs the latest deployed app while still exposing native
  Camera/Geolocation. (App id `com.esgastraa.hrms`.)

### 3.2 Request flow & auth guard
- **`proxy.ts`** (Next's middleware; renamed `proxy` in this Next version) runs on
  every request. It:
  - resolves the Supabase session,
  - lets **public paths** through (`/login`, `/signup`, `/forgot-password`,
    `/reset-password`, `/auth`, icons, manifest),
  - redirects unauthenticated users to `/login`,
  - blocks employees/managers from `/admin/*`,
  - forces users with incomplete profiles to `/onboarding`.

### 3.3 Fast navigation
- The signed-in user is resolved **once per group layout** (server side) and shared
  via a client **`CurrentUserProvider`** context. Pages read `useCurrentUser()` and
  render client-side, so moving between pages is instant (no per-page round-trip).
- A **singleton Supabase browser client** avoids multiple auth instances competing
  on token refresh (which previously caused random logouts).
- React Query caches data (2-min stale time) so revisiting a page is instant.

### 3.4 Folder structure (high level)
```
/app
  /(auth)      login, signup, forgot-password, reset-password
  /(employee)  dashboard, attendance, tasks, leave, chat, meetings, evaluation, profile, team, onboarding
  /(admin)     admin/* (overview, employees, attendance, tasks, evaluation, leave, chat, meetings)
  /api         notify, meetings/notify, leaves/notify, auth/callback
/components     ui, attendance, tasks, chat, admin, evaluation, meetings, leave, profile, dashboard
/lib            supabase clients, geolocation, constants, validation, audit, email, nav, dates, hooks
/supabase/migrations   0001 … 0019 (SQL)
/scripts        backup.sh
/.github/workflows     backup.yml
```

---

## 4. Access model (roles & permissions)

- Role is stored on `profiles.role` (`employee` | `manager` | `admin`).
- **Manager scoping** is by **department string** — a manager manages profiles whose
  `department` matches theirs. Keep department values consistent (fixed list below).
- Enforcement is **in the database** via Row-Level Security (RLS), not just the UI.

### Departments (fixed list)
1. Operations & Client Deliverables
2. Research & Content
3. Digital Marketing
4. Other (with a "specify" text field)

### SECURITY DEFINER helper functions (bypass RLS safely)
- `is_admin()` — is the caller an admin?
- `is_manager_of(target_uuid)` — is the caller the manager of that person's dept?
- `my_department()` — the caller's department.
- `is_meeting_host(meeting_id)`, `is_meeting_attendee(meeting_id)` — meeting access.

These exist so policies can check membership **without recursively triggering other
policies** (which previously caused an "infinite recursion" error on meetings).

---

## 5. Feature modules (detail)

### 5.1 Authentication
- Supabase Auth: **email + password** and **Continue with Google** (OAuth) on both
  **login and signup**. OAuth returns through `/auth/callback`.
- **Self sign-up** creates **employee** accounts only — role is forced server-side by
  the `handle_new_user` trigger (clients can't self-assign admin/manager).
- **Forgot password:** `/forgot-password` sends a reset email → link lands on
  `/reset-password` where the recovery session sets the new password.
- **Change password:** available in **Profile** for signed-in users.
- Passwords are stored **hashed (bcrypt) by Supabase** — never in the codebase or DB
  in plaintext.

### 5.2 Onboarding
- First login forces `/onboarding` (until `profile_completed = true`).
- Multi-step form (Personal / Employment / Education / Documents / Review) with a
  progress bar and localStorage draft autosave.
- Auto-generated employee ID in `ESGA-0001` format (admin can edit it later).
- Saves to `employee_details`; uploads documents to the private documents bucket.

### 5.3 Geofenced attendance
- Employee taps **Mark Attendance** → the app gets GPS location → computes distance to
  the nearest office (Haversine) → **Present** enabled only if within radius, not a
  mock GPS, and inside the check-in window.
- **Present before 12:00 PM; Late at/after 12:00 PM.**
- **Standard check-out window 7–8 PM**; check-out records hours worked.
- **Work-from-home** button skips the geofence and logs a WFH day.
- On successful check-in / WFH, an automatic **"Good morning"** message posts to Global
  chat; on check-out, a **"Bye bye, take care"** message (best-effort, never blocks).
- Every attendance row stores raw lat/long + distance + timestamp for audit.
- **Geolocation robustness:** uses `watchPosition` with `maximumAge:0`, resolving on a
  good fix instantly or the best reading within ~2.5 s (cap 8 s) — avoids iOS serving a
  stale cached position.
- **Guardrails:** mock-location flag (native), check-in hour window, radius per office.

### 5.4 Tasks & proof of work
- **90-day master plan** (`task_plans`) + **three sequential 30-day plans**
  (`thirty_day_plans`, unlocked in order).
- **Daily task log** = one row per task (`daily_task_logs`) tied to a plan + day number,
  each with its own title, description and **proof-of-work files** (any file type +
  camera capture + pasted links).
- **Edit / delete with full history:** employees can edit or (soft) delete their tasks.
  Every change **snapshots the previous version** (text + proof + timestamp) into
  `daily_task_log_history` via a database trigger. Edited tasks show an **"Updated"**
  marker (with a full version history viewer) visible to the employee **and**
  admin/manager. Soft-deleted tasks are hidden everywhere but kept in history + backup.
- **Assigned tasks:** admin/manager can assign a task to an employee (with deadline +
  attachments); the assignee is notified.

### 5.5 Performance evaluation
- **Admin evaluates managers; managers evaluate their department's employees.**
- Open a person → pick a date → review that day's tasks (check each) → a **0–100 %
  slider** unlocks → save a private rating (+ optional private note).
- **Private by design (enforced in DB):** the person rated can **never** read their
  score; a manager can't see the admin's rating of them. Evaluators see only what they
  authored (admins get oversight).
- **History tab:** append-only log of every rating action (`evaluation_events`).
- **Analytics tab:** daily performance line chart per person, or average bars per person.

### 5.6 Team meetings
- Admin schedules meetings and invites **anyone**; managers schedule for **their own
  department** members only (enforced in RLS).
- Fields: title, date/time, meeting link, optional access username/password, agenda,
  member picker.
- Invitees get an **in-app notification + email**. **Upcoming / History** tabs;
  cancelling is a **soft-cancel** (kept in history). A **red badge** on the Meetings nav
  shows new meetings.

### 5.7 Leave requests
- Employee fills type/dates/reason and routes the request to **Admin**, their
  **Department manager**, or **both**.
- Recipients get an **in-app notification + email**; the requester is notified on the
  decision. Admin/managers **approve/reject** with a note (RLS scopes who can act).
- **Filters** (status + month/year) and a **month calendar** showing who's on leave
  (green = approved, amber = pending).

### 5.8 Team chat
- **Global**, **[Department]**, and **Direct (1-to-1)** tabs.
- **Direct messages are private** to the two participants — not even admins can read
  them (RLS).
- Rich composer: **emoji picker** + **attach (+)** for images/documents. Attachments
  render as openable links. Full history loads. **Unread red badges** on the Chat nav +
  per-conversation, with arrival toasts.
- Admin can toggle `can_chat` per user (chat moderation).

### 5.9 Notifications & analytics
- **In-app bell** (realtime) for assigned tasks, comments, meetings, leave decisions.
- **Attendance analytics:** status breakdown + **weekly working hours** (shown as
  `Xh Ym`), with month/year filters; admin can pick any employee.
- **9-hour/day completion** is shown **only to admin/manager** (hours + a 9h ✓ / `/9h`
  badge in the attendance table and employee detail) — employees are not shown a target.

---

## 6. Data model (tables)

All in the Postgres `public` schema. **RLS is enabled on every table.**

| Table | Purpose |
|---|---|
| `profiles` | One row per user (role, name, employee_id, department, can_chat, avatar_url, email, profile_completed) — mirrors `auth.users` |
| `employee_details` | Full profile (dob, age, phone, emails, address, emergency contact, designation, department, joining date, reporting manager, education JSON, documents JSON) |
| `office_locations` | Office branches (lat/long + radius) for geofencing |
| `attendance` | Check-in/out rows (times, lat/long, distance, mock flag, status present/late/absent/wfh) |
| `task_plans` | 90-day master plan |
| `thirty_day_plans` | Three sequential 30-day plans |
| `daily_task_logs` | One row per daily task (title, description, proof files, day, is_late, edit_count, updated_at, deleted_at) |
| `daily_task_log_history` | Append-only snapshots of every task edit/delete |
| `assigned_tasks` | Admin/manager → employee task assignments |
| `admin_comments` | Comments on daily task logs |
| `evaluations` | Latest performance rating per evaluator/subject/day (private) |
| `evaluation_events` | Append-only log of every rating action |
| `meetings` | Scheduled meetings (host, link, optional credentials, schedule, department, cancelled_at) |
| `meeting_attendees` | Meeting invitees |
| `leave_requests` | Leave requests (type, dates, reason, recipients, status, reviewer) |
| `messages` | Chat messages (global / department / direct, with attachments) |
| `notifications` | In-app notifications (realtime) |
| `profile_audit_log` | Who edited which profile fields and when |

### Triggers (server-side automation)
- `handle_new_user` — creates a `profiles` row (role forced to employee) on signup.
- Privilege-change guard on `profiles` — blocks non-admins from changing role/privileges.
- Notification triggers — assigned tasks, meeting invites, leave request + decision.
- `log_task_log_change` — snapshots task history + maintains edit_count/updated_at.

---

## 7. Where data is stored (and why)

### 7.1 Structured data → **Supabase Postgres**
All application records (attendance, tasks, evaluations, meetings, leave, chat text,
profiles, notifications, audit) live in Postgres tables. **Why:** relational integrity,
Row-Level Security, realtime, and SQL analytics in one managed service.

### 7.2 Files → **Supabase Storage buckets**
| Bucket | Visibility | Holds |
|---|---|---|
| `employee-documents` | **Private** (signed URLs) | Aadhaar, PAN, resume, certificates, bank, photos, address proof |
| `proof-of-work` | **Private** (signed URLs) | Daily task proof + assigned-task proof |
| `avatars` | Public | Profile photos (so they render everywhere without signing) |
| `task-attachments` | Public | Files admins attach to assigned tasks |
| `chat-files` | Public | Chat images/documents (unguessable UUID paths) |

**Why private vs public:** identity documents and proof-of-work are sensitive → private
with short-lived signed URLs. Avatars/chat/task attachments are low-risk and benefit from
instant rendering, so they use public buckets with unguessable paths.

### 7.3 Path scoping
Uploads are stored under the owner's user-id folder (`<uid>/…`) and storage policies
enforce that a user can only write to their own folder.

---

## 8. Security

- **Authentication:** Supabase Auth; passwords hashed with **bcrypt** server-side.
  Google OAuth supported.
- **Authorisation:** **Row-Level Security on every table.** Employees can read/write only
  their own rows; managers are scoped to their department via `is_manager_of()`; admin
  bypasses via `is_admin()`. The UI mirrors this, but the DB is the real gate.
- **Privilege guard:** a trigger prevents non-admins from changing `role`/privileges even
  if they craft a direct API call. (Promoting the first admin is done via SQL with the
  trigger temporarily disabled.)
- **Private data guarantees (DB-enforced):**
  - **Direct chat messages** — visible only to the two participants (admins included cannot
    read them).
  - **Evaluations** — the person rated can never read their score; a manager can't see the
    admin's rating of them.
  - **Identity documents / proof-of-work** — private buckets, signed URLs only.
- **Secrets management:** only `NEXT_PUBLIC_*` values (Supabase URL + anon key) reach the
  browser (safe by design). Service-side secrets (email credentials, DB URL, backup
  tokens) live in **Vercel env vars** and **GitHub Actions secrets** — never in the code.
- **HTTP security headers** (in `next.config.ts`): `X-Frame-Options: SAMEORIGIN`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (camera/geo
  self only), and HSTS.
- **Internal docs (`CLAUDE.md`)** are git-ignored (kept local, not in the public repo).

---

## 9. Notifications & email

- **In-app notifications** are created by database triggers and delivered in realtime to
  the notification **bell**. Types: assigned task, comment, meeting invite, leave request,
  leave decision.
- **Email** is sent from server API routes via **Nodemailer + Gmail SMTP**:
  - `/api/notify` — activity routing (employee activity → manager, manager activity →
    admin, assigned/comment → affected employee + supervisor).
  - `/api/meetings/notify` — meeting invites + credentials to attendees.
  - `/api/leaves/notify` — leave request to admin/manager; decision to the requester.
- Emails are multipart (HTML + text) with deliverability headers to reduce spam. For the
  most reliable inbox delivery, a custom sending domain (e.g. via a dedicated email
  provider) is recommended as a future step.
- **Email credentials** live in Vercel env (`EMAIL_HOST/PORT/USER/PASS/ADMIN`). If the
  Gmail account password changes, the **app password is revoked** and must be regenerated.

---

## 10. Backups & disaster recovery

**Automated nightly backup** via GitHub Actions (`.github/workflows/backup.yml` →
`scripts/backup.sh`), at **02:00 IST** (and manually via *Actions → Nightly Backup → Run
workflow*).

### What is captured
1. **`database.sql.gz`** — a full `pg_dump` of the **entire** database (every table). This
   single file can restore the whole DB.
2. **`csv/*.csv`** — human-readable spreadsheet exports of all key tables (profiles,
   employee_details, attendance, tasks, task history, assigned tasks, comments, messages,
   notifications, audit, evaluations, evaluation_events, meetings, meeting_attendees,
   **leave_requests**, office_locations).
3. **`storage/<bucket>/…`** — every uploaded file from all five buckets
   (employee-documents, proof-of-work, avatars, task-attachments, chat-files).

### Where it goes
- **GitHub** → the workflow run's **`hrms-backup` artifact** (30-day retention).
- **Google Drive** → `HRMS-Backups/<timestamp>/` (if the `RCLONE_CONF` secret is set).

### Redundancy summary
- **Live copy:** Supabase (primary).
- **Off-site copy 1:** GitHub artifact.
- **Off-site copy 2:** Google Drive.

### How to restore
- **Whole DB:** create/point to a Postgres, then `gunzip -c database.sql.gz | psql <url>`.
- **A single table:** open the relevant `csv/*.csv`.
- **Files:** re-upload from `storage/<bucket>/…` to the matching bucket.

> Tip: for a permanent pre-change snapshot, **download the GitHub artifact** and keep it,
> since GitHub artifacts expire after 30 days.

---

## 11. Deployment & environments

- **Hosting:** Vercel — team `esg-astraa`, project `esg-astraa-hrms`.
- **Auto-deploy:** pushing to GitHub `main` triggers a Vercel build + deploy.
  - ⚠️ **Commit author must be `namrata.esgastraa@gmail.com`** — a mismatched author gets
    the deploy **blocked** by Vercel's "git author not found".
- **Environment variables (Vercel):**
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, safe in browser)
  - `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_ADMIN` (server only)
- **Supabase Redirect URLs:** include `https://esg-astraa-hrms.vercel.app/**` (covers
  OAuth + password-reset callbacks).
- **APK:** built with Capacitor pointing `server.url` at the deployed URL; declare
  `ACCESS_FINE_LOCATION` + `CAMERA` in `AndroidManifest.xml`; build a signed APK in
  Android Studio (see `BUILD.md`).
- **Backup secrets (GitHub Actions):** `SUPABASE_DB_URL`, `SUPABASE_S3_*`, `RCLONE_CONF`,
  `GDRIVE_DEST`.

---

## 12. Database migrations

SQL files in `supabase/migrations/`, applied in order in the Supabase SQL Editor.

| File | What it adds |
|---|---|
| `0001_init_schema` | Base tables, employee-id sequence, `handle_new_user`, `is_admin()`, privilege guard, RLS |
| `0002_storage_buckets` | Private `employee-documents` + `proof-of-work` buckets |
| `0003_profile_directory` | Relax `profiles` read so directory/chat can show names |
| `0004_harden_signup_role` | Force new signups to `employee` |
| `0005_round2_phaseB` | Task redesign (30-day plans, per-task logs), notifications, avatars bucket |
| `0006_fix_admin_bootstrap` | Fix admin bootstrap trigger |
| `0008_managers_departments` | Manager role, department scoping, department chat, `is_manager_of()` / `my_department()` |
| `0009_manager_proof_read` | Managers can read team proof-of-work |
| `0010_profiles_email` | Store email on `profiles` |
| `0011_chat_direct_attachments` | Direct messages + chat attachments + `chat-files` bucket |
| `0012_evaluations` | Evaluations table + private RLS |
| `0013_evaluation_events` | Append-only evaluation history |
| `0014_meetings` | Meetings + attendees + invite notifications |
| `0015_fix_meeting_rls_recursion` | Definer helpers to fix RLS recursion |
| `0016_meeting_cancel` | Soft-cancel column (meeting history) |
| `0017_employee_dob` | Store date of birth |
| `0018_leave_requests` | Leave requests + RLS + notify triggers |
| `0019_task_edit_history` | Task edit/delete + history table + snapshot trigger |

---

## 13. Operational runbooks

### 13.1 Create the admin
1. Supabase → **Authentication → Users → Add user** (email + password, tick **Auto
   Confirm**).
2. Promote (guard trigger blocks direct role changes, so disable it briefly):
   ```sql
   alter table public.profiles disable trigger user;
   update public.profiles set role='admin', profile_completed=true
   where id = (select id from auth.users where email = '<admin-email>');
   alter table public.profiles enable trigger user;
   ```

### 13.2 Promote a manager
Admin → **Employees → (person) → Make manager** (they must have a department set).

### 13.3 Reset the app to empty (keep schema + office)
1. **Back up first** (run the Nightly Backup workflow; download the artifact).
2. Truncate all app tables (keep `office_locations`) + `delete from auth.users` +
   restart `employee_id_seq`.
3. Empty storage buckets via **Dashboard → Storage** (SQL delete on `storage.objects` is
   blocked by Supabase).
4. Re-create the admin (13.1).

### 13.4 Add / move an office
Insert/update `office_locations` (name, latitude, longitude, radius_meters). Radius is
per office — widen it if the office is indoors and GPS is weak.

### 13.5 Rotate credentials (recommended periodically)
DB password, Gmail app password, Vercel token, and rclone token — rotate in the
respective dashboards and update the corresponding Vercel/GitHub secrets.

---

## 14. Known limitations & assumptions

- **Working hours need check-out** — hours only compute when an employee checks out.
- **Manager scoping keys on the department string** — keep department values consistent
  across profiles or team/chat/evaluation grouping breaks.
- **Mock-GPS detection** is best-effort on native and unavailable on the web.
- **iOS location** needs **Precise Location ON** for the geofence to be accurate.
- **Email** uses Gmail SMTP (subject to sending limits + spam filtering); a custom domain
  is the recommended upgrade.
- **DOB** is blank for employees onboarded before the DOB field existed (age-only data
  can't be reversed into a birth date) — set it once via profile edit.

---

## 15. FAQ

**Where is our data physically?** In Supabase (managed Postgres + storage). Backups are
copied to GitHub and Google Drive nightly.

**Is attendance/tasks/etc. in the backup?** Yes — the full `database.sql.gz` contains
every table, plus readable CSVs, plus all uploaded files.

**Can an employee see their evaluation score?** No — it's private and enforced in the
database, not just hidden in the UI.

**Can admins read private DMs?** No — direct messages are readable only by the two
participants.

**What happens if someone edits or deletes a task?** The previous version (text + proof +
timestamp) is snapshotted into history; deletes are soft (hidden but retained). An
"Updated" marker shows to the employee and admin/manager.

**Why did a deploy get blocked?** The commit author didn't match a known Git user — commit
as `namrata.esgastraa@gmail.com`.

**Why did email stop sending?** Changing the Gmail account password revokes the app
password; generate a new app password and update `EMAIL_PASS`.

**Why does the geofence say I'm far away?** Usually iOS Precise Location is off, or the
phone served a cached position — the app now forces a fresh fix; enable Precise Location.

---

## 16. Maintenance & roadmap

**Regular maintenance**
- Verify the nightly backup succeeds (check the Actions run + Drive folder).
- Keep department values consistent when adding people.
- Rotate credentials periodically.

**Possible future enhancements**
- Leave **balances/quotas** (e.g. 12 casual days/year).
- Push notifications (proof-of-work reminders).
- Custom email sending domain for inbox reliability.
- Hardened native mock-location plugin.
- Per-department chat channels beyond the current model.

---

*This document describes the system as built. It intentionally contains no passwords or
secret keys — those live only in Supabase, Vercel env vars, and GitHub Actions secrets.*
