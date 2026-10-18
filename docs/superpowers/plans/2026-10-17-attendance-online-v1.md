# Absensi Online V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan Absensi Online V1 ke PixelApps dengan kamera live, GPS wajib, waktu/status WITA berbasis server, role HR, permission HR/attendance terpisah, audit koreksi, dan integrasi aman dengan Form Izin/Cuti existing.

**Architecture:** Attendance dibuat sebagai subsystem additive: helper domain murni untuk rule/status WITA, persistence PostgREST terpisah, API module terpisah yang di-install dari `server.js`, dan UI mobile-first terpisah yang di-wire ke shell PixelApps. Foto memakai signed Cloudinary upload pattern existing, tetapi signature dan metadata attendance terikat capture nonce single-use. Form Cuti existing hanya diubah pada gate Admin HR dan Manajemen Akun; approval `leave_approve` tetap independen.

**Tech Stack:** Node.js/CommonJS, Express, PostgREST/PostgreSQL, vanilla JS/PWA, Cloudinary signed upload, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-17-attendance-online-v1-design.md`

## Global Constraints

- Timezone VPS/cron/backup tidak boleh diubah.
- Timezone bisnis attendance selalu `Asia/Makassar`.
- Sumber timestamp resmi hanya backend/server; client tidak menentukan waktu/status/overtime.
- Kamera attendance wajib `getUserMedia`; tidak ada file/gallery picker.
- GPS latitude/longitude/accuracy wajib, tetapi tidak ada geofence/radius V1.
- Senin–Jumat 08:00–16:30; Sabtu 08:30–13:00; Minggu non-workday; tanpa toleransi.
- Overtime: <120 menit = none, 120–239 = stage 1, >=240 = stage 2.
- `Pekerjaan / kegiatan` opsional.
- Role `HR` tidak otomatis mendapat `hr_admin_manage`, `leave_approve`, atau permission attendance admin.
- `hr_admin_manage` dan `leave_approve` harus independen.
- `superadmin` bypass `hr_admin_manage`, `leave_approve`, `attendance_view_all`, `attendance_manage_rules`, dan `attendance_manage`.
- User biasa selalu dapat attendance miliknya sendiri tanpa permission admin.
- Semua perubahan schema additive; flow Cuti existing dan data/history lama harus tetap aman.

## Review Focus

- Duplicate CHECK_IN/CHECK_OUT atau retry network tidak boleh membuat event ganda.
- Capture nonce expired/replayed/milik user lain harus ditolak.
- Perbatasan waktu tepat 08:00/08:30, 16:30/13:00, +120, +240 menit harus deterministic dalam WITA.
- Permission HR/attendance tidak boleh bocor lewat role HR/Manager/Admin; hanya checklist atau Superadmin bypass.
- Kamera/GPS failure harus menghasilkan UI state yang jelas dan tidak menawarkan upload file sebagai fallback.

---

### Task 1: Attendance Rule Domain dan WITA Calculation

**Files:**
- Create: `pxl-attendance-core.js`
- Create: `tests/attendance-v1-core.test.js`

**Interfaces:**
- Produces: `witaParts(date)`, `workDateWita(date)`, `defaultAttendanceRules()`, `resolveAttendanceRule(rules,date)`, `calculateCheckInStatus(rule,date)`, `calculateCheckOutStatus(rule,date)`.
- Consumes: none.

- [ ] **Step 1: Write failing core tests** untuk weekday/Saturday/Sunday, exact start boundary, one minute late, early checkout, <120, 120, 239, 240 menit overtime.
- [ ] **Step 2: Run** `node --test tests/attendance-v1-core.test.js` dan verifikasi FAIL karena module/functions belum ada.
- [ ] **Step 3: Implement `pxl-attendance-core.js`** dengan timezone fixed `Asia/Makassar`, tanpa membaca timezone OS/VPS.
- [ ] **Step 4: Run core tests** dan verifikasi PASS.
- [ ] **Step 5: Commit** `feat: add attendance WITA rule engine`.

### Task 2: Attendance Database Schema dan DB Adapters

**Files:**
- Create: `migrations/PXL-ATT-0001-attendance-online-v1.sql`
- Modify: `db-core.js`
- Create: `tests/attendance-v1-migration.test.js`
- Create: `tests/attendance-v1-db.test.js`

**Interfaces:**
- Consumes: rule field names dari Task 1.
- Produces DB adapters: `getAttendanceRules`, `replaceAttendanceRules`, `getAttendanceRecord`, `getAttendanceRecords`, `insertAttendanceRecord`, `updateAttendanceRecord`, `insertAttendanceCaptureToken`, `consumeAttendanceCaptureToken`, `insertAttendanceHistory`, `getAttendanceHistory`.

- [ ] **Step 1: Write failing migration tests** yang memastikan tabel `attendance_rules`, `attendance_records`, `attendance_capture_tokens`, `attendance_history`, unique `(user_id,work_date)`, seed default WITA, RLS/authenticated access, dan `notify pgrst, 'reload schema'` ada.
- [ ] **Step 2: Run migration test** dan verifikasi FAIL.
- [ ] **Step 3: Add additive SQL migration** dengan defaults Senin–Jumat/Sabtu/Minggu sesuai spec dan no destructive rewrite.
- [ ] **Step 4: Write failing DB adapter tests** untuk exact PostgREST resource names dan atomic/single-use token consumption contract.
- [ ] **Step 5: Implement adapters di `db-core.js`** dan export semua interface di atas.
- [ ] **Step 6: Run DB + migration tests** dan verifikasi PASS.
- [ ] **Step 7: Commit** `feat: add attendance persistence`.

### Task 3: Attendance API, Capture Nonce, Cloudinary Binding, dan Permission Enforcement

**Files:**
- Create: `pxl-attendance-api.js`
- Modify: `server.js`
- Create: `tests/attendance-v1-api.test.js`

**Interfaces:**
- Consumes: Task 1 calculation functions dan Task 2 DB adapters; existing `cloudinaryReady`, `cloudinarySignature`, `requireAuth`, session user, account `custom_menus`.
- Produces endpoints `/api/attendance/today`, `/me`, `/capture-context`, `/photo-signature`, `/check-in`, `/check-out`, `/admin`, `/rules`, `/admin/:id`, `/admin/:id/history`.

- [ ] **Step 1: Write failing API tests** untuk auth, GPS validation, nonce TTL/single-use/user-event binding, signed Cloudinary public-id prefix attendance, duplicate check-in/out rejection, checkout-without-checkin rejection, server-side status ignoring client status/timestamp, admin permission gates, and Superadmin bypass.
- [ ] **Step 2: Run API tests** dan verifikasi FAIL.
- [ ] **Step 3: Implement API module** dengan helper `hasAttendancePermission(req, permission)`; `superadmin` selalu true; role HR/Manager/Admin tidak diberi implicit admin permission.
- [ ] **Step 4: Bind Cloudinary upload** dengan public id attendance scoped by user/work-date/nonce; metadata submit harus cocok dengan nonce yang belum expired/used.
- [ ] **Step 5: Install API module from `server.js`** tanpa mengubah route existing.
- [ ] **Step 6: Run API tests** dan verifikasi PASS.
- [ ] **Step 7: Commit** `feat: add attendance API`.

### Task 4: Role HR, Account Permission Checklist, dan Form Cuti Admin Gate

**Files:**
- Modify: `public/index.html`
- Modify: `public/pxl-stg-0005a.js`
- Modify: `public/pxl-stg-0005d.js`
- Modify: `public/pxl-urg-0016a-account-permission-single-source.js`
- Modify: `public/pxl-urg-0017-account-permission-hard-save.js`
- Modify: `pxl-stg-0009a-leave-api.js`
- Modify: `public/pxl-stg-0009a-leave.js`
- Create: `tests/attendance-v1-permissions.test.js`

**Interfaces:**
- Consumes: account `custom_menus`, existing `pr_roles` for `leave_approve`.
- Produces role option `hr` and permission checkboxes `hr_admin_manage`, `attendance_view_all`, `attendance_manage_rules`, `attendance_manage`; Superadmin bypass behavior.

- [ ] **Step 1: Write failing permission tests** yang memastikan HR muncul di create/edit role, checklist baru ikut save/load/reset, HR tidak otomatis admin/approve, Manager/Admin tidak otomatis `hr_admin_manage`, `leave_approve` tetap terpisah, dan Superadmin bypass kedua jalur.
- [ ] **Step 2: Run tests** dan verifikasi FAIL.
- [ ] **Step 3: Add role HR + checklist UI/persistence** mengikuti collector single-source existing tanpa membuat collector kedua yang race.
- [ ] **Step 4: Replace hard-coded Admin HR role gate** di leave API/UI dengan `hr_admin_manage || superadmin`; jangan ubah rule `leave_approve` kecuali memastikan bypass Superadmin tetap ada.
- [ ] **Step 5: Run permission + existing leave tests** dan verifikasi PASS.
- [ ] **Step 6: Commit** `feat: add HR and attendance permissions`.

### Task 5: Mobile-first Attendance UI dan Camera/GPS Flow

**Files:**
- Create: `public/pxl-attendance-v1.js`
- Modify: `public/index.html`
- Modify: `public/sw.js`
- Create: `tests/attendance-v1-ui.test.js`
- Create: `tests/attendance-v1-wiring.test.js`

**Interfaces:**
- Consumes: Task 3 attendance endpoints and permissions exposed by current user.
- Produces menu/page `Absensi Online`, live camera capture, watermark, GPS state, today card, own history, admin tabs based on permissions.

- [ ] **Step 1: Write failing UI/wiring tests** yang memastikan tidak ada `<input type="file">` pada attendance, `getUserMedia` + geolocation required, capture blocked when either missing, optional work context, WITA labels, overtime stage detail, admin controls permission-gated, asset cache-busted, and service worker does not stale-cache API.
- [ ] **Step 2: Run UI tests** dan verifikasi FAIL.
- [ ] **Step 3: Implement camera flow** using `navigator.mediaDevices.getUserMedia`, canvas JPEG capture, watermark from server capture context, no upload/gallery fallback.
- [ ] **Step 4: Implement GPS flow** requiring finite lat/lon/accuracy before capture context and submit.
- [ ] **Step 5: Implement own attendance UI** today status, contextual CHECK_IN/CHECK_OUT, optional work context, own history/detail.
- [ ] **Step 6: Implement admin UI** list/detail, rules editor, correction with mandatory reason/history; render controls only for permissions, Superadmin sees all.
- [ ] **Step 7: Wire menu/cache/service worker** without changing unrelated navigation.
- [ ] **Step 8: Run UI/wiring tests** dan verifikasi PASS.
- [ ] **Step 9: Commit** `feat: add attendance mobile UI`.

### Task 6: Integration Regression, Migration Dry Run, GitHub Push, dan VPS Deploy

**Files:**
- Test all changed files; no new feature scope.

**Interfaces:**
- Consumes: Tasks 1–5 complete branch.
- Produces: production deployment on top of baseline `8f904cecc05c1907966f6be9b65775988c011fb4` with migration applied once.

- [ ] **Step 1: Run focused attendance tests** and require 0 failures.
- [ ] **Step 2: Run full suite** `node --test tests/*.test.js` and require all tests PASS.
- [ ] **Step 3: Run syntax checks** `node --check server.js pxl-attendance-api.js pxl-attendance-core.js public/pxl-attendance-v1.js`.
- [ ] **Step 4: Review `git diff`/`git status`** ensuring no runtime `backups/`, `public/downloads/`, secrets, timezone/cron changes, or unrelated files.
- [ ] **Step 5: Push feature commits to GitHub and fast-forward `main` only after green verification.**
- [ ] **Step 6: On VPS production, fetch/reset to GitHub `main`, apply `migrations/PXL-ATT-0001-attendance-online-v1.sql` once, then restart only the supervised Node process safely.**
- [ ] **Step 7: Verify production** HEAD equals origin/main, HTTP 200, attendance asset is live, `/api/attendance/*` anonymous auth is protected, DB tables/rules exist, and VPS timezone/cron remain unchanged.
- [ ] **Step 8: Run post-deploy full regression suite** and require 0 failures before reporting completion.
