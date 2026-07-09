# ESG Astraa — HRMS & Attendance Portal
## Claude Code Project Instructions (persistent memory file)

> This file is the single source of truth for how Claude Code should build, extend, and reason about this project. Read this in full before writing any code. Keep this file updated as decisions are made — treat it as living documentation, not a one-time prompt.

---

## 1. Project Overview

We are building an internal **HRMS + Attendance system** for **ESG Astraa**, a B2B ESG/sustainability consulting firm. The company currently has no formal attendance or employee-records system — this app replaces manual tracking entirely.

**Two deliverables from one codebase:**
1. A responsive **web app** (works fully in desktop + mobile browser)
2. An **Android APK** built from the same codebase (installable, not necessarily Play-Store listed initially)

**Two user roles:**
- **Employee** — marks attendance, maintains profile, submits daily tasks + proof of work, uses team chat
- **Admin** (HR/founder) — sees all employees, all attendance, all task submissions, can comment, manages the 90-day master task sheets, moderates chat

---

## 2. Tech Stack (locked-in decisions — do not deviate without discussion)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Same app serves web + is wrapped for APK |
| Native wrapper | **Capacitor** | Wraps the Next.js build into an installable Android APK. Gives access to native Camera, Geolocation, Filesystem plugins |
| Database + Auth + Storage | **Supabase** | Postgres DB, Supabase Auth (email/password), Supabase Storage (proof-of-work files), Supabase Realtime (chat + live admin dashboard) |
| Styling | **Tailwind CSS** | Utility-first, matches brand tokens defined below |
| State/data fetching | **@supabase/supabase-js** + React Query (`@tanstack/react-query`) | Avoid prop-drilling, cache attendance/task data |
| Forms | **react-hook-form + zod** | For onboarding form (many fields) and task submission validation |
| Camera/File capture | **@capacitor/camera**, `<input type="file" capture>` fallback on plain web | Must work both in APK (native camera) and browser (file picker/webcam) |
| Geolocation | **@capacitor/geolocation** (native) + browser `navigator.geolocation` (web fallback) | See Section 7 for logic |
| Push/local notifications | **@capacitor/local-notifications** (optional, phase 2) | For "submit proof of work" reminder after 8 hrs |
| Hosting (web) | Vercel or existing AWS EC2 (esgastraa.com infra — Docker/nginx, per prior deployment) | Confirm with Omkar before deciding |
| Icons | `lucide-react` | Consistent icon set across the app |

Do not introduce Firebase — this project uses **Supabase only**, unlike the earlier BRSR Document Collection app.

---

## 3. Brand Guidelines (apply consistently everywhere)

```css
--color-dark-base: #232234;       /* backgrounds, sidebar, headers */
--color-electric-violet: #7516EA; /* primary actions, active states */
--color-cool-blue: #2E94F3;       /* secondary accents, links, info */
--color-white: #FFFFFF;
--gradient-primary: linear-gradient(135deg, #7516EA 0%, #2E94F3 100%);
```

- **Typography:** Raleway (Google Fonts) for all headings and body text. Load via `next/font/google`.
- **Tone:** Clean, professional, SaaS-grade — this is an internal enterprise tool, not a consumer app. Think Notion/Linear-level polish, not a template dashboard.
- Buttons/CTAs use the violet→blue gradient. Success states use a soft green accent (introduce `#22C55E` only for success, never as a brand color).
- Dark base (`#232234`) is the sidebar/nav background; main content area stays white/light gray for readability, with dark-base used again in headers/footers for consistency.
- Use rounded corners (`rounded-xl`/`rounded-2xl`), soft shadows, generous whitespace — avoid a cramped "admin panel from 2015" look.

---

## 4. Core Modules & Features

### 4.1 Authentication & Roles
- Supabase Auth, email + password.
- Two roles stored in a `profiles` table: `employee` | `admin`. Role gates routes via middleware (`/admin/*` blocked for employees).
- Admin creates the initial employee accounts (email + temp password) OR employees self-register with an invite code tied to ESG Astraa's domain — **decide with Omkar before building**; default to **admin-issues-credentials** since HR wants control over who's added.

### 4.2 Employee Onboarding (first login)
On first login, force-redirect to `/onboarding` (check a `profile_completed` boolean) with a multi-step `react-hook-form`:
- **Personal:** full name, DOB/age, phone, personal email, address, emergency contact
- **Employment:** designation, department, joining date, employee ID (auto-generated `ESGA-0001` format), reporting manager
- **Education:** degree, institution, year of passing (repeatable field array for multiple qualifications)
- **Documents:** Aadhaar/PAN (optional upload), photo
- **Bank/statutory** (optional phase 2): PF/UAN, bank account for payroll readiness

All fields save to a `employee_details` table. Show a progress bar across steps; final step = review + Save, which flips `profile_completed = true` and redirects to the main dashboard.

### 4.3 Geofenced Attendance
See **Section 7** below for the full technical approach — read it before implementing this module.

Core flow:
1. Employee opens app → taps "Mark Attendance"
2. App requests location permission, gets current lat/long
3. Compares against office lat/long (configurable in an `office_locations` table, supports multiple office branches)
4. If within radius (default 20m, but see Section 7 for why we recommend making this configurable and slightly larger) → **Present** button becomes active
5. Tap Present → row inserted into `attendance` table with timestamp, lat/long, distance-from-office
6. Show check-out flow similarly at end of day (optional, but recommended for hours-worked tracking)

### 4.4 Tasks & Goals
Two levels:
- **90-Day Master Plan** — submitted once (or once per quarter), stored in `task_plans` table, free-text/structured goals per week or milestone. Admin can view/comment.
- **Daily Task Log** — each working day, employee logs today's task activity + uploads **proof of work**.
  - The "Submit Proof of Work" button is **disabled/hidden until 8 hours after the day's attendance check-in timestamp** (calculate via `now() - attendance.check_in_time >= interval '8 hours'`). Show a countdown/progress indicator instead of just hiding it, so it doesn't feel broken.
  - Accept **all file types** (docs, images, PDFs, spreadsheets, zip) via Supabase Storage, plus direct camera capture (native camera in APK via Capacitor Camera plugin, `capture` attribute fallback on web).
  - On successful submission → trigger the celebratory popup (Section 4.5).

### 4.5 Interactive Submission Feedback
After a successful daily task + proof submission, show a friendly modal/toast:
- Randomize between a few messages ("🎉 Great job — task completed on time!", "✅ Nailed it! See you tomorrow.", "💪 Another day, another win logged.")
- Use a lightweight confetti or checkmark animation (e.g. `canvas-confetti` package or a simple CSS animation) — keep it snappy, not obnoxious.
- If submitted **late** (after some cutoff, e.g. next day), show a neutral/encouraging-but-not-celebratory message instead — don't reward late submissions the same way.

### 4.6 Team Chat
- A single company-wide chat channel to start (phase 2: per-department channels).
- Supabase Realtime subscription on a `messages` table (`sender_id`, `content`, `created_at`).
- Admin can grant/revoke chat access per employee via a `can_chat` boolean on `profiles` (per your spec: "this role will be given by admin").
- Keep UI simple — sender name/avatar, timestamp, text bubble. File sharing in chat is a nice-to-have, not required for v1.

### 4.7 Admin Dashboard
- **Employee directory:** list/search/filter all employees, view full `employee_details`.
- **Attendance overview:** calendar/table view per employee, flags for late/absent/geofence anomalies.
- **Task review:** see 90-day plans and daily submissions per employee, with an inline comment box (`admin_comments` table linked to `task_log_id`).
- **Chat moderation:** toggle `can_chat` per employee.
- Use Supabase Row Level Security (RLS) so employees can only ever read/write their own rows, while `admin` role bypasses via a policy check against `profiles.role`.

---

## 5. Database Schema (Supabase / Postgres — starting point)

```sql
-- profiles (mirrors auth.users)
profiles (
  id uuid primary key references auth.users(id),
  role text check (role in ('employee','admin')) default 'employee',
  full_name text,
  employee_id text unique,
  profile_completed boolean default false,
  can_chat boolean default true,
  created_at timestamptz default now()
);

employee_details (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  age int, phone text, personal_email text, address text,
  emergency_contact text, designation text, department text,
  joining_date date, reporting_manager text,
  education jsonb, -- array of {degree, institution, year}
  documents jsonb,  -- array of storage URLs
  updated_at timestamptz default now()
);

office_locations (
  id uuid primary key default gen_random_uuid(),
  name text, latitude double precision, longitude double precision,
  radius_meters int default 20
);

attendance (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  office_id uuid references office_locations(id),
  check_in_time timestamptz, check_out_time timestamptz,
  check_in_lat double precision, check_in_lng double precision,
  distance_meters double precision,
  is_mock_location boolean default false, -- see Section 7
  status text check (status in ('present','late','absent')) default 'present'
);

task_plans ( -- 90-day master plan
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  plan_content jsonb, submitted_at timestamptz default now()
);

daily_task_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  attendance_id uuid references attendance(id),
  task_description text,
  proof_files jsonb, -- array of {url, type, filename}
  submitted_at timestamptz,
  is_late boolean default false
);

admin_comments (
  id uuid primary key default gen_random_uuid(),
  task_log_id uuid references daily_task_logs(id),
  admin_id uuid references profiles(id),
  comment text, created_at timestamptz default now()
);

messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id),
  content text, created_at timestamptz default now()
);
```

Enable **RLS on every table**. Employees: `USING (profile_id = auth.uid())`. Admins: `USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))`.

---

## 6. Folder Structure

```
/app
  /(auth)/login
  /(employee)/dashboard
  /(employee)/onboarding
  /(employee)/attendance
  /(employee)/tasks
  /(employee)/chat
  /(admin)/admin/employees
  /(admin)/admin/attendance
  /(admin)/admin/tasks
  /(admin)/admin/chat
/components
  /ui        -- shared buttons, cards, modals (brand-styled)
  /attendance
  /tasks
  /chat
  /admin
/lib
  supabaseClient.ts
  geolocation.ts   -- haversine + mock-location checks
  constants.ts     -- brand colors, office coordinates
/capacitor.config.ts
/tailwind.config.ts
CLAUDE.md          -- this file
```

---

## 7. Geolocation Logic — Read Before Building Attendance Module

Your 20m-radius idea is a good starting point but raw phone GPS has **±10–30m error even outdoors, and much worse indoors** (this matters if your office is inside a building). A few things to build in from day one so this doesn't feel broken for real employees:

1. **Haversine formula** to compute distance between employee's lat/long and office lat/long (store office coordinates in `office_locations`, support multiple branches).
2. **Radius should be configurable per office**, not hardcoded — start around 50–100m if the office is indoors/in a building, tighten later once you see real accuracy data from employee phones. A too-tight radius will cause false "you're not at office" complaints.
3. **Mock-location detection:** Android's location API exposes an `isFromMockProvider` flag — check this via the Capacitor Geolocation plugin (or a small native plugin if needed) and flag/reject attendance where `is_mock_location = true`. This is your main defense against employees spoofing GPS apps.
4. **Optional secondary signal (recommended):** office WiFi SSID check — if the phone is connected to the office WiFi network name, treat that as a strong corroborating signal alongside GPS. Combine "within radius OR on office WiFi" rather than relying on GPS alone.
5. **Selfie check-in (optional, higher trust):** capture a quick selfie at check-in time alongside location — no liveness detection needed for v1, just a timestamped photo for the admin to audit manually if something looks off.
6. **Time-window guardrails:** restrict check-in to a sensible office-hours window so old GPS caches at 2 AM don't create anomalies.
7. Always store the **raw lat/long + distance + timestamp** on every attendance record (already in the schema above) so admin has an audit trail, even for approved check-ins.

---

## 8. Build & Deploy — Web + APK

- **Web:** standard Next.js deploy (Vercel, or existing AWS/Docker/nginx setup on esgastraa.com infra).
- **APK:**
  1. `npx cap init` in the Next.js project
  2. `next build && next export` (or use `output: 'export'` in `next.config.js` if going static — confirm no server-only routes are required; if Supabase handles all data, static export works well) OR run Capacitor against a hosted URL if server rendering is needed
  3. `npx cap add android`
  4. `npx cap sync`
  5. Open in Android Studio → build signed APK
- Camera and Geolocation permissions must be declared in `AndroidManifest.xml` (Capacitor handles most of this via plugin install, but double-check `ACCESS_FINE_LOCATION` and `CAMERA` are present).

---

## 9. Coding Conventions

- TypeScript everywhere, strict mode on.
- Server actions / API routes for anything touching Supabase service-role key — **never expose service role key client-side**.
- Reusable `<Button>`, `<Card>`, `<Modal>`, `<Input>` components in `/components/ui` styled with the brand tokens — build these first before feature screens, so the whole app looks consistent.
- Loading and empty states for every data-fetching screen (attendance history, task logs, admin tables) — this is a real tool people will use daily, so it needs to feel finished, not like a prototype.
- Mobile-first responsive design — most employees will check in from their phone.

## 10. Open Decisions To Confirm With Omkar Before/During Build
- Self-registration vs admin-issued credentials for employee accounts
- Single office location or multiple branches at launch
- Whether check-out is mandatory or attendance is check-in-only for v1
- Whether push notifications (8-hour proof-of-work reminder) are in v1 scope or phase 2

---

## Deployment
- **Live (Vercel):** https://esg-astraa-hrms.vercel.app — team `esg-astraa`, project `esg-astraa-hrms`. `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set for production/preview/development. Verified: public pages 200, protected routes 307→/login (proxy middleware live), Supabase auth health 200, RLS enforced (anon reads blocked). Redeploy: `vercel deploy --prod --scope esg-astraa`. APK `server.url` now defaults to this URL.

## Fix 0009 — manager proof-of-work read (DB only)
- Bug: managers got "couldn't open the file" opening a team member's proof. Cause: `proof_read` storage policy allowed only owner/admin. `0009_manager_proof_read.sql` extends it to `is_manager_of((folder_uid)::uuid)`. No code/redeploy — just run the SQL. Covers plan files too (same bucket).

## Round 2 — Managers + departments + department chat (REQUIRES migration 0008)
- **Roles:** added `manager` (role in employee|manager|admin). Admin = superadmin, promotes an employee → manager of their department (button on `/admin/employees/[id]`). `profiles.department` added + backfilled from `employee_details.department`; set on onboarding + profile edit.
- **Manager scope (RLS):** `is_manager_of(target)` + `my_department()` SECURITY DEFINER helpers. Managers can **read** attendance/task_plans/thirty_day_plans/daily_task_logs/employee_details of same-department members, **assign tasks** to them (`assigned_tasks` write extended), and comment. Writes to others' rows still owner/admin only. Split every `_rw` policy into `_select` (adds `is_manager_of`) + `_write`.
- **Manager UI:** `manager` nav gets **My Team** (`/team` list of department members → `/team/[id]` reuses `AdminEmployeeDetail` with `scope="manager"`: attendance/tasks/plans/assign-task, no doc delete/promote). Managers live in the `(employee)` group (not admin), so proxy still blocks `/admin/*`.
- **Department chat:** `messages.department` (null = global). `ChatClient` has **Global** + **[Department]** tabs; RLS: read global OR own-department (admin all), post only to global or own department. `my_department()` gates it.
- **Note:** manager scoping keys on the `department` string matching across profiles — keep department values consistent.

## Round 2 — Polish pass (logo, speed, PWA, docs)
- **Logo:** real ESG Astraa wordmark at `public/logo.png` via `components/ui/Logo.tsx`; used on login, signup, and the sidebar brand (on a white chip so the gradient reads on the dark sidebar). Replaced all "EA" monograms.
- **Removed the Phase-0 landing page:** `/` now server-redirects to `/login` (or role home if signed in).
- **Speed (instant nav):** added `CurrentUserProvider` (client context) — the group layout resolves the user once (server) and shares it; **all employee + admin pages are now client components** reading `useCurrentUser()`, so navigating between them is pure client-side (no per-page `getCurrentUser`/RSC round-trip). Combined with the layout-hoisted shell + React Query cache + singleton client, nav is now snappy.
- **PWA safe-area:** `statusBarStyle` → `default`, `viewportFit:cover`, `.pt-safe`/`.pb-safe` utilities (`env(safe-area-inset-*)`) on TopNav / Sidebar / main so the installed app no longer renders under the notch/status bar. (Fixes the home-screen overlap.)
- **Onboarding documents:** the Documents step now has the required categories — Aadhaar, PAN, Resume/CV, Educational certs & mark sheets, Relieving letter (optional), Bank details, Passport photos, Address proof — each stored with its category label in `employee_details.documents`.
- **Employee document viewer:** `/profile` now shows "My documents" with **View** buttons (signed URLs) via `EmployeeDocuments`; profile page is client + React Query.

## Round 2 — Perf + PWA pass
- **Perf (SPA-like nav):** app shell (sidebar/TopNav/auth) hoisted into `app/(employee)/layout.tsx` + `app/(admin)/layout.tsx`. In App Router layouts are preserved across child navigation, so the sidebar no longer re-renders/flashes and `getCurrentUser` runs once per group entry (not per page). Pages now return content only. `onboarding` moved to `app/onboarding` (outside the shell). TopNav title derives from pathname (`titleForPath`). Admin layout also gates non-admins → /dashboard. Combined with the earlier singleton client + 2-min React Query cache, navigation is much snappier. (Proxy per-request `getUser` remains for security; a cookie/JWT-claims cache was intentionally skipped to avoid an onboarding-redirect loop.)
- **PWA / installable:** `app/manifest.ts` (`display:standalone`, brand theme), generated `app/icon.tsx` + `app/apple-icon.tsx` (ImageResponse "EA" gradient), `appleWebApp` meta + `viewportFit:cover`. Added `/icon`,`/apple-icon`,`/manifest.webmanifest` to proxy public paths (were 307→/login). Add-to-Home-Screen now launches full-screen with no URL bar.

## Round 2 — Phase B (features, complete — REQUIRES migration 0005)
⚠️ **Run `supabase/migrations/0005_round2_phaseB.sql` before using** (recreates `daily_task_logs`+`admin_comments` — test data wiped as confirmed; `task_plans` kept).
- **B1 Task sheet:** `task_plans` = 90-day master (once). New `thirty_day_plans` (plan_number 1–3, sequential unlock). Redesigned `daily_task_logs` = **one row per task** (`thirty_day_plan_id`, `day_number` 1–90, `task_title`, `description`, per-task `proof_files`). UI: `/tasks/plan` (master + 3 sequential 30-day plans), `/tasks/today` (active plan → pick day → multi tasks, each with proof), `/tasks/history` (grouped by day), `/tasks/assigned`. **Removed the old 8h-lock / single-daily-submission model** (didn't fit the new day/task hierarchy).
- **B2 Admin overhaul:** `/admin/employees/[id]` rebuilt as `AdminEmployeeDetail` — tabs Overview/Attendance/Tasks/Activity; **View** buttons (signed URLs) for every document + per-task proof, showing Plan/Day; audit log + assigned tasks under Activity. `TaskReview` updated to new columns + Plan/Day badge.
- **B3 Profile editing + audit:** `/profile` (`ProfileEditForm`) lets employees edit details + photo anytime; `lib/audit.ts` writes `profile_audit_log` (who/what/when) via `diffRecords`; shown in admin Activity tab.
- **B4 Photos:** public `avatars` bucket + `profiles.avatar_url`; onboarding + profile edit upload here; `Avatar` shows the photo (initials fallback) in chat, admin employee list, admin attendance, task review, shell.
- **B5 WFH:** attendance `status` widened to include `wfh`; "Mark WFH" button on `/attendance` skips geofence entirely; WFH-aware badges/filters everywhere.
- **B6 Assign task + notifications:** `assigned_tasks` (admin→employee, message/time/deadline) + `notifications` (+ realtime); AFTER-INSERT trigger notifies assignee; `NotificationBell` in TopNav (unread badge, realtime, mark read); employees see assigned tasks at `/tasks/assigned`.

## Round 2 — Phase A (bug fixes, complete)
- **A1 (Gmail login / "email rate limit exceeded"):** root cause = NOT domain validation (login accepts any email) and NOT a code bug — it's the **Supabase built-in email mailer rate limit** (~2–4/hr) hit while sending signup **confirmation** emails (`mailer_autoconfirm=false`). Added **Google OAuth**: `signInWithOAuth` button on `/login` + `app/auth/callback/route.ts` (`exchangeCodeForSession`) + `/auth` in proxy public paths. Trigger fires for OAuth signups too (it's on `auth.users`). **User must:** enable Google provider in Supabase + create Google Cloud OAuth creds; and turn OFF "Confirm email" (or add SMTP) to stop the rate-limit error.
- **A2 (checkout → logged out everywhere):** root cause = `createClient()` returned a **new browser GoTrueClient per call** (every component made one); concurrent token refreshes across instances triggered **refresh-token rotation** that invalidated the session → proxy saw no user → redirected all pages to /login (surfaced at checkout = hours after login, token expired). Fix = **singleton browser client** (`lib/supabaseClient.ts`). Also hardened `proxy.ts` to carry refreshed auth cookies onto redirect responses. Checkout logic itself was fine.
- **A3 (history visibility + filters):** employee `AttendanceHistory` now fetches full history by **month+year filter** (removed the 30-row cap); admin `AttendanceTable` gets the same month+year filter (server-side range) + a proper all-employees dropdown. Both WFH-aware (forward-compat for B5).
- **A4 (latency):** root causes = (1) many GoTrueClient instances → redundant refreshes (fixed by singleton), (2) low React Query `staleTime` (30s) refetching on every nav. Fixes: `staleTime` 2 min + `gcTime` 10 min + `refetchOnMount:false`; offices cached `Infinity`; **optimistic** chat send (insert→select→append, realtime dedupes by id). Note: protected navigation still runs proxy(getUser+profile) + server page(getUser+profile) ≈ sequential Supabase round-trips — a deeper win (role in JWT claims) is possible later.

## Post-launch changes
- **Self-registration added (§10 decision reversed to self-signup):** `app/(auth)/signup` — email/password/name, creates **employee** accounts only; login⇄signup cross-links; `/signup` added to proxy public paths. **Security:** migration `0004_harden_signup_role.sql` makes `handle_new_user` always assign `role='employee'` (never from client metadata) — must be run. Email confirmation is ON (`mailer_autoconfirm=false`) so signups must confirm via email; for smooth internal onboarding consider turning "Confirm email" off in Supabase Auth, or configure SMTP. Admins are promoted manually (SQL/dashboard), never self-serve.
- **Admin account created:** `admin@esgastraa.com` (id `0f09546c-8277-47cd-bfd2-4cf3460bb2a3`) — created via signup API (unconfirmed, employee by default); promote + confirm via SQL.

## Build Progress Log
- **Phase 0 (complete):** Next.js 16 (App Router, TS strict) scaffolded; Tailwind v3 configured with brand tokens + `bg-gradient-primary` / `text-gradient-primary` utilities; Raleway loaded via `next/font`; React Query provider wired into root layout; Supabase browser/server clients via `@supabase/ssr` + `lib/geolocation.ts` (Haversine) + `lib/constants.ts`; folder structure per Section 6; `.env.local.example` placeholders. **Note:** create-next-app installed Next 16 (satisfies "14+"); Tailwind pinned to v3 to keep the documented `tailwind.config.ts` approach.
- **Phase 8 (complete):** Capacitor APK wrap. **Decision:** static export NOT used — app needs SSR + `proxy.ts` middleware + server components, so per §8 fallback the APK loads the **hosted web app** via `capacitor.config.ts` `server.url` (native Camera/Geolocation bridge still injected). `appId=com.esgastraa.hrms`, `appName="ESG Astraa HRMS"`, `webDir=capacitor-www` (fallback splash `capacitor-www/index.html`). `@capacitor/android` installed; `npx cap add android` scaffolded `android/` (3 plugins detected: camera, geolocation, filesystem). `AndroidManifest.xml` given INTERNET + ACCESS_FINE/COARSE_LOCATION + CAMERA (+ non-required uses-feature). npm scripts `cap:sync`/`cap:open`. Full signed-APK workflow in `BUILD.md`. **User action to finish APK:** set `server.url`/`CAP_SERVER_URL` to the deployed URL, then build the signed APK in Android Studio (needs Android SDK/JDK, not available in this env). **Open Decision still pending (§10):** web hosting (Vercel vs AWS EC2).
- **Phase 7 (complete):** Admin dashboard under `app/(admin)/admin/*` (all client tables via React Query; admin RLS bypass through `is_admin()`). **Overview** (`AdminOverview`): present-today %, pending-proof count, today anomalies, headcount tiles + recent chat feed. **Employees** (`EmployeesTable` + `/employees/[id]`): searchable directory → server-rendered detail with personal/employment/education + **signed URLs** for private documents. **Attendance** (`AttendanceTable`): 300 recent joined w/ names, date + employee filters, anomaly flags (mock GPS / >150m / late). **Tasks** (`TaskReview`): tabbed daily submissions (with proof signed-URL open + inline `admin_comments` insert) and 90-day plans, all joined to employee names. **Chat mgmt** (`ChatManagement`): per-user `can_chat` toggle (admin update allowed by RLS + privilege trigger no-ops for admins). `.env.local` now populated with the real project URL + anon key, so builds run against Supabase.
- **Phase 6 (complete):** Team chat at `app/(employee)/chat` → `ChatClient`. Loads last 100 messages (embed `sender:profiles(full_name)`), subscribes to Supabase Realtime `postgres_changes` INSERT on `messages` (channel `public:messages`), resolves sender names via a ref cache (fetches on miss), dedupes by id, auto-scrolls to latest, day separators. Bubble UI: own messages right/gradient, others left with `Avatar`+name+time. Composer: Enter-to-send; **disabled with an explanatory lock message when `profiles.can_chat=false`** (read-only). **NEW MIGRATION `0003_profile_directory.sql` — USER MUST RUN IT:** relaxes `profiles` SELECT to any authenticated user (needed so chat/directory can show other users' names; writes still guarded by the privilege trigger). Also unblocks Phase 7 admin directory reads.
- **Phase 5 (complete):** Tasks under `app/(employee)/tasks` (`/tasks`→redirect `/tasks/today`; tabs via `TasksTabs`). **Daily log** (`DailyTaskForm`): requires today's check-in, live **8h countdown** (`check_in_time + 8h`, ticking Xh Ym Ss + progress bar) that gates the Submit button; description + **required** proof upload (all file types + camera `capture`) → `proof-of-work` bucket; inserts `daily_task_logs` (links `attendance_id`); `is_late` = submitted on a later calendar day than check-in; on-time → `canvas-confetti` + random `CELEBRATION_MESSAGES` modal, late → neutral modal (no confetti); already-submitted + not-checked-in states handled. **90-day plan** (`TaskPlanForm`): repeatable weekly milestones (`useFieldArray`) → `task_plans.plan_content.milestones`, plus list of previously submitted plans. **History** (`TaskHistory`): last 30 daily logs with On time/Late badges + proof counts. **Assumptions:** proof file is required (not just description); each plan submit inserts a new `task_plans` row (quarterly re-submit friendly); late = different calendar day than check-in.
- **Phase 4 (complete):** Attendance at `app/(employee)/attendance` = `AttendanceClient` + `AttendanceHistory`. `lib/geolocation.ts` adds `getCurrentPosition()` (Capacitor native w/ permission + best-effort mock flag; browser `navigator.geolocation` fallback), `nearestOffice()` (multi-branch), `formatDistance()`. Live status card with SVG `RadiusIndicator`, within/outside badge, GPS accuracy, guardrails: **Present disabled unless within radius AND not mock AND inside check-in window (6–22h) AND not already checked in**. Insert writes all schema fields (lat/lng/distance/is_mock/status); status `late` if check-in hour ≥ `LATE_THRESHOLD_HOUR` (10). Optional check-out implemented (updates `check_out_time`). Dashboard home rebuilt with `TodayStatusCard` + quick links. Uses React Query (queryKey `["attendance", ...]`) w/ invalidation. **Office seeded by user:** ESG Astraa Bhandarkar Rd Pune (18.517556, 73.837306), radius 75m. **Assumptions:** late threshold 10:00 local; check-in window 6–22h; **native mock-location detection is best-effort** — the standard Capacitor Geolocation plugin doesn't reliably expose `isFromMockProvider`, so a small custom native plugin is needed for hard enforcement (§7.3, phase-2 hardening). Web GPS can't detect mocks at all.
- **Phase 3 (complete):** Real onboarding at `app/(employee)/onboarding` → `components/onboarding/OnboardingForm.tsx`: 5-step RHF+zod wizard (Personal / Employment / Education repeatable via `useFieldArray` / Documents / Review) with brand `Stepper`, per-step validation on Continue, and localStorage draft autosave (`esga-onboarding-draft-<uid>`, cleared on submit). Photo + ID uploads → `employee-documents` bucket via `lib/storage.ts` `uploadUserFiles()` (uid-folder-scoped; stores storage *paths* in `documents` jsonb, resolve via signed URL later). Submit upserts `employee_details` (DOB→computed `age`), sets `profiles.full_name` + `profile_completed=true`, redirects `/dashboard`. Validation in `lib/validation/onboarding.ts`. Employee ID shown read-only. **Note:** email/year validated via regex (Zod 4). Benign lint warning: RHF `watch()` subscription flagged by React Compiler (documented pattern, works).
- **Phase 2 (complete, migrations run & verified in project wfxospkthtrrwhxruetn):** SQL in `supabase/migrations/` — `0001_init_schema.sql` (all Section 5 tables + FKs, `employee_id_seq` → `ESGA-0001`, `handle_new_user` trigger on `auth.users`, `is_admin()` SECURITY DEFINER helper to avoid RLS recursion, privilege-change guard trigger on profiles, RLS + policies on every table, realtime for `messages`+`attendance`) and `0002_storage_buckets.sql` (private `employee-documents` + `proof-of-work` buckets with uid-folder-scoped policies). Auth: `app/(auth)/login` (Supabase password auth, brand split-screen, role-based redirect), `lib/auth.ts` (`getCurrentUser`), `lib/types.ts`. **`proxy.ts`** (Next 16 renamed `middleware`→`proxy`) enforces: unauth→/login, employees blocked from /admin/*, incomplete profiles→/onboarding. Minimal stub pages for /dashboard, /admin, /onboarding so the flow is testable now (replaced in Phases 3–7). **DEVIATIONS from spec:** (a) file is `proxy.ts` not `middleware.ts` — Next 16 deprecation; (b) build requires `NEXT_PUBLIC_SUPABASE_*` env present (NEXT_PUBLIC vars inline at build) — matters for the Phase 8 static export. **User must run both migrations in Supabase before Phase 3.**
- **Phase 1 (complete):** Full component library in `components/ui` (barrel export via `components/ui/index.ts`): `Button` (primary/secondary/destructive/ghost + sizes + loading), `Card` family, `Badge` (status pills), `Avatar` (gradient initials fallback), form primitives `Input`/`Textarea`/`Select`/`DatePicker` (forwardRef, RHF-ready, shared `Field` shell), `Modal` (portal + Esc + scroll-lock, used for confirm + celebratory popup), `Toast` (`ToastProvider` + `useToast`, wired into root layout), `EmptyState`, `LoadingSkeleton` (`Skeleton`/`SkeletonText`/`SkeletonCard`/`SkeletonRow`), and the app shell `Sidebar`/`TopNav`/`AppShell` (role-aware nav from `lib/nav.ts`, mobile drawer). Added `lib/utils.ts` (`cn()` via clsx + tailwind-merge, `initials()`) and shimmer/fade/scale/toast keyframes to Tailwind. Demo at `/app/design-system` (dev-only, unlinked). Deps added: `clsx`, `tailwind-merge`. Build + lint clean.
