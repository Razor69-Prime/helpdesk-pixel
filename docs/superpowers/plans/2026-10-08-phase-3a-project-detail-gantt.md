# PixelApps VNext Phase 3A — Project Detail Core + Gantt Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing manual Project Tracker with a Project Detail center, one Primary Work Order link per project, a sequential calendar-day Gantt Plan, and landscape PDF export without changing existing BOQ, Today Achievement, SO→WO, or WO→MR flows.

**Architecture:** Keep existing Project Tracker/Project Report as the source of truth and add isolated Phase 3A persistence for Primary WO and Gantt Plan. Server-side services validate and calculate all planned dates; a new focused frontend module renders Project Detail and Gantt while calling the existing BOQ/Project Report module for management actions.

**Tech Stack:** Node.js 18+, Express, PostgREST/PostgreSQL 17, vanilla JavaScript, existing jsPDF 2.5.1 + AutoTable, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-08-phase-3a-project-detail-gantt-design.md`

## Global Constraints

- Project creation remains manual.
- One Project has at most one Primary WO; one WO cannot be Primary WO for two projects.
- Linking/unlinking a WO must not change or delete the WO.
- Do not change existing SO→WO, WO→MR, Material Request, BOQ, Today Achievement, TTD, photo, remarks, Survey, or status flows.
- Gantt stages are sequential and use calendar days including Saturday/Sunday.
- Duration is a positive whole number from 1 to 3650; maximum 100 stages per project.
- Phase 3A stores Plan only; Actual/Realisasi is Phase 3B and must remain separate.
- `project_gantt_manage` and `project_primary_wo_manage` default OFF for every non-Superadmin account.
- Existing `project_boq_manage` behavior remains: Manager/Superadmin default access plus explicitly granted accounts.
- No guessed Primary WO backfill and no automatic Gantt creation during migration.
- Production is not pushed/deployed and migration is not applied until separately authorized after implementation verification.

## Review Focus

- Date-only calculations crossing weekends/month/year boundaries must never shift because of server/browser timezone.
- Re-saving a Gantt Plan must atomically replace its stages; a failed save must not leave half of the new plan stored.
- A missing/deleted linked WO must render as unavailable and remain relinkable instead of breaking Project Detail.
- Manager role reset must keep `project_boq_manage` default but must not silently grant the two new Phase 3A management permissions.
- Very long plans must remain printable: PDF timeline is split into fixed 31-calendar-day landscape pages while repeating stage labels and project metadata.

---

### Task 1: Phase 3A persistence and deterministic calendar-date engine

**Files:**
- Create: `PXL-VNEXT-3A-MIGRATION.sql`
- Create: `project-vnext-3a.js`
- Modify: `db-core.js` Project Tracker section and `module.exports`
- Test: `tests/vnext-3a-project-core.test.js`

**Interfaces:**
- Produces `DEFAULT_PROJECT_GANTT_STAGES: string[]` with the seven approved default stage names.
- Produces `buildSequentialGanttPlan(startDate, stages)` returning normalized `{name,duration_days,notes,sort_order,planned_start,planned_end}[]` or throwing a validation error.
- Produces DB methods `getProjectPrimaryWorkOrder(projectId)`, `upsertProjectPrimaryWorkOrder(projectId,ticketId,actor)`, `getProjectGanttPlan(projectId)`, `replaceProjectGanttPlan(projectId,startDate,stages,actor)`, `getTicketById(id)`, and `searchTicketsCompact(query,limit)`.

- [ ] **Step 1: Write failing core tests**

Create tests that assert: migration contains `project_primary_work_orders`, `project_gantt_plans`, `project_gantt_stages`, unique Primary-WO ownership, audit columns, duration check `1..3650`, and RPC `pxl_vnext_3a_replace_project_gantt_plan`; default stages are exactly `Preparation`, `Order Barang`, `Tanam Tiang`, `Instalasi Perangkat`, `Konfigurasi`, `Testing / Commissioning`, `Serah Terima`; `buildSequentialGanttPlan('2026-10-31',[3,2])` yields `2026-10-31..2026-11-02` then `2026-11-03..2026-11-04`; invalid date, 0, negative, decimal, >3650, empty name, and >100 stages throw.

- [ ] **Step 2: Run core test and verify RED**

Run: `node --test tests/vnext-3a-project-core.test.js`
Expected: FAIL because migration/module/interfaces do not exist yet.

- [ ] **Step 3: Add additive SQL persistence**

Create tables:
- `project_primary_work_orders(project_id primary key, ticket_id unique nullable, created_by, created_at, updated_by, updated_at)` with project cascade and ticket `ON DELETE SET NULL` so missing WO is recoverable.
- `project_gantt_plans(project_id primary key, start_date, created_by, created_at, updated_by, updated_at)`.
- `project_gantt_stages(id uuid primary key, project_id, name, duration_days, planned_start, planned_end, notes, sort_order, created_by, created_at, updated_by, updated_at)` with unique `(project_id,sort_order)`.
- RPC `pxl_vnext_3a_replace_project_gantt_plan(p_project_id uuid,p_start_date date,p_stages jsonb,p_actor text)` that upserts the header and replaces all stages inside one PostgreSQL transaction/function call.

Follow the existing permissive RLS policy pattern; application authorization remains enforced in Express.

- [ ] **Step 4: Implement the date engine**

In `project-vnext-3a.js`, implement/export `DEFAULT_PROJECT_GANTT_STAGES` and `buildSequentialGanttPlan(startDate,stages)`. Parse `YYYY-MM-DD` as explicit UTC date parts, calculate with UTC day arithmetic, normalize `sort_order` to `0..n-1`, and never use local-time midnight parsing.

- [ ] **Step 5: Add DB adapter methods**

In `db-core.js`, implement the six interfaces above. `replaceProjectGanttPlan` sends the already calculated stage rows to `/rpc/pxl_vnext_3a_replace_project_gantt_plan`; `searchTicketsCompact` returns at most 20 rows and selects only `id,wo_number,work_order_type,status,customer_name,project_name,technician,technicians,worked_at,created_at`.

- [ ] **Step 6: Run core test and syntax checks**

Run: `node --test tests/vnext-3a-project-core.test.js && node --check project-vnext-3a.js && node --check db-core.js`
Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add PXL-VNEXT-3A-MIGRATION.sql project-vnext-3a.js db-core.js tests/vnext-3a-project-core.test.js
git commit -m "PXL-VNEXT-3A add project Gantt persistence and date engine"
```

### Task 2: Project Detail, Primary WO, Gantt APIs, and backend permissions

**Files:**
- Modify: `server.js` Project Tracker section
- Test: `tests/vnext-3a-project-api.test.js`

**Interfaces:**
- Consumes Task 1 DB/date interfaces.
- Produces `GET /api/projects/:id/detail`.
- Produces `GET /api/projects/:id/work-order-options?q=`.
- Produces `PUT /api/projects/:id/primary-work-order` with `{ticket_id}` and `DELETE /api/projects/:id/primary-work-order`.
- Produces `GET /api/projects/:id/gantt-plan` and `PUT /api/projects/:id/gantt-plan` with `{start_date,stages}`.

- [ ] **Step 1: Write failing API contract tests**

Assert route presence, Project Tracker read protection on GETs, explicit backend checks for `project_gantt_manage` and `project_primary_wo_manage`, Superadmin bypass, duplicate-WO conflict handling, missing project/WO `404`, and Gantt PUT calling `buildSequentialGanttPlan` before persistence. Add a regression assertion that existing SO→WO and WO→MR routes are untouched/present.

- [ ] **Step 2: Run API test and verify RED**

Run: `node --test tests/vnext-3a-project-api.test.js`
Expected: FAIL because Phase 3A routes/permissions are absent.

- [ ] **Step 3: Add Phase 3A permission helpers**

Add `hasProjectVnextPermission(req, permission)` and `requireProjectVnextPermission(permission)`: Superadmin always passes; every other role passes only if `user.custom_menus` explicitly contains the requested permission. Do not inherit Manager defaults for these two permissions.

- [ ] **Step 4: Implement Project Detail aggregation**

`GET /api/projects/:id/detail` must select the existing project from `db.getProjects()`, reuse `buildProjectReportRows()` for the existing BOQ/report row, read Primary WO relation and Gantt plan, resolve linked WO with `getTicketById`, and return `{project,report,primary_work_order,gantt_plan}`. If relation exists but WO is gone, return `primary_work_order:{unavailable:true,ticket_id:<old id>}` instead of failing the whole detail response.

- [ ] **Step 5: Implement Primary WO search/link/unlink**

Search returns compact WO options. Link validates project and WO, rejects a WO already linked to another project with HTTP `409`, persists only the relation, and logs `LINK PRIMARY WO`. Unlink sets `ticket_id` to `null`, leaves the WO untouched, and logs `UNLINK PRIMARY WO`.

- [ ] **Step 6: Implement Gantt GET/PUT**

GET returns stored plan plus `default_stages: DEFAULT_PROJECT_GANTT_STAGES`; when no plan exists, `plan` is `null`. PUT validates the project, calls `buildSequentialGanttPlan`, persists with `replaceProjectGanttPlan`, logs `CREATE GANTT PLAN` or `UPDATE GANTT PLAN`, and returns the freshly read plan.

- [ ] **Step 7: Run API/core tests and syntax**

Run: `node --test tests/vnext-3a-project-core.test.js tests/vnext-3a-project-api.test.js && node --check server.js`
Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add server.js tests/vnext-3a-project-api.test.js
git commit -m "PXL-VNEXT-3A add Project Detail and Gantt APIs"
```

### Task 3: Project Detail shell, Overview, BOQ reuse, and permission UI

**Files:**
- Create: `public/pxl-vnext-3a-project-detail.js`
- Modify: `public/index.html` Project list action, permission definitions/default reset, and script include
- Modify: `public/pxl-stg-0016-project-report.js` public helper only
- Test: `tests/vnext-3a-project-ui.test.js`

**Interfaces:**
- Produces `window.pxlProjectVnext3A.open(projectId)` and `window.pxlProjectVnext3A.refresh()`.
- Produces `window.pxlProjectReport.openBoqProject(projectId)` to open the existing BOQ editor for the selected project without duplicating BOQ data.

- [ ] **Step 1: Write failing UI shell/permission tests**

Assert `PROJECT_PERMISSIONS` contains `project_gantt_manage` and `project_primary_wo_manage`; role reset grants Manager only `project_boq_manage` from Project permissions; Project rows render a native Detail button calling the Phase 3A module; only `Overview`, `BOQ & Report`, `Gantt Chart`, and `Work Order` tabs are exposed; future MR/Documents/SPJ tabs are absent; script cache version is `PXL-VNEXT-3A`.

- [ ] **Step 2: Run UI test and verify RED**

Run: `node --test tests/vnext-3a-project-ui.test.js`
Expected: FAIL because the new module/UI does not exist.

- [ ] **Step 3: Add permission controls without changing BOQ defaults**

Append the two new permission definitions under Custom Fitur Project Tracker. Change Manager role-reset defaults from all `PROJECT_PERMISSIONS` to only `['project_boq_manage']`; Superadmin remains force-enabled by the existing Superadmin handling.

- [ ] **Step 4: Add native Project Detail entry point**

Add a `Detail` action beside Edit/Delete in `renderProjectList()` that calls `window.pxlProjectVnext3A.open(p.id)`. Keep existing Edit/Delete behavior unchanged.

- [ ] **Step 5: Build isolated Project Detail module**

Inject one responsive modal/detail surface with the four approved tabs. `open(projectId)` loads `/projects/:id/detail`; Overview renders existing project fields, Material/Jasa/Overall progress, Primary WO summary, and planned period. BOQ & Report renders the existing `report.items` read-only and never creates a second BOQ store.

- [ ] **Step 6: Add direct handoff to existing BOQ editor**

Expose `openBoqProject(projectId)` from `pxl-stg-0016-project-report.js`: load existing report rows, set `boqProjectId`, show the existing BOQ view, select the project, and render its existing editor. Show the Project Detail `Kelola BOQ` button only when current access already permits BOQ management.

- [ ] **Step 7: Run UI tests and syntax**

Run: `node --test tests/vnext-3a-project-ui.test.js && node --check public/pxl-vnext-3a-project-detail.js && node --check public/pxl-stg-0016-project-report.js`
Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add public/index.html public/pxl-vnext-3a-project-detail.js public/pxl-stg-0016-project-report.js tests/vnext-3a-project-ui.test.js
git commit -m "PXL-VNEXT-3A add Project Detail core UI"
```

### Task 4: Primary Work Order UI

**Files:**
- Modify: `public/pxl-vnext-3a-project-detail.js`
- Test: `tests/vnext-3a-primary-wo-ui.test.js`

**Interfaces:**
- Consumes Task 2 Primary WO APIs.
- Work Order tab renders the linked WO or a link/search form; management controls require `project_primary_wo_manage` or Superadmin.

- [ ] **Step 1: Write failing Primary WO UI tests**

Assert the module searches by WO/customer/project text, links by `ticket_id`, supports unlink confirmation, renders unavailable linked WO safely, and `Buka di Daftar WO` navigates to `tickets`, sets `#t-search` to the WO number, resets pagination, and renders the existing ticket list instead of inventing a second WO detail flow.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3a-primary-wo-ui.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement WO read state and management state**

Render WO number/type/status/customer/technicians/date when linked. For authorized users, provide search results capped by the API, `Link Primary WO`, and `Unlink`; after either action refresh Project Detail. Read-only users see only current relation information.

- [ ] **Step 4: Implement existing-WO navigation**

`Buka di Daftar WO` closes Project Detail, calls existing `switchTab('tickets',...)`/equivalent existing tab navigation, sets the ticket search to the exact WO number, resets `ticketListPage`, and calls `renderTickets()`/existing refresh path. Do not modify WO status or workflow.

- [ ] **Step 5: Run Primary WO + regression tests**

Run: `node --test tests/vnext-3a-primary-wo-ui.test.js tests/vnext-2c.test.js tests/pxl-vnext-2c4-wo-list-performance.test.js`
Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add public/pxl-vnext-3a-project-detail.js tests/vnext-3a-primary-wo-ui.test.js
git commit -m "PXL-VNEXT-3A add Primary WO project link UI"
```

### Task 5: Sequential Gantt Plan UI and landscape PDF

**Files:**
- Modify: `public/pxl-vnext-3a-project-detail.js`
- Test: `tests/vnext-3a-gantt-ui.test.js`

**Interfaces:**
- Consumes Task 2 Gantt GET/PUT.
- Uses existing `window.jspdf.jsPDF`; no new dependency.

- [ ] **Step 1: Write failing Gantt UI/PDF tests**

Assert initial editor uses server `default_stages` only when `plan===null`; user can add/rename/delete/reorder stages and edit integer duration/note; browser preview recalculates sequential dates using a date-only UTC helper; Save sends `{start_date,stages}` to the API; management controls require `project_gantt_manage` or Superadmin; Download PDF is hidden/disabled until a stored plan exists; PDF uses `orientation:'landscape'`, project name/period/generated date/duration, and constant `PDF_DAYS_PER_PAGE=31`.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3a-gantt-ui.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement responsive Gantt editor and preview**

Render stage names in a fixed/narrow left column and a contained horizontally scrollable calendar grid on the right. Use project start date + sequential duration; reorder is via explicit Up/Down buttons (not drag-only), maximum 100 rows, and inline validation mirrors server limits. Read-only users see the stored chart without edit controls.

- [ ] **Step 4: Persist and reload authoritative plan**

On Save, send names/durations/notes in visible order. Replace local preview with the server response after save so displayed dates always match stored server-calculated dates.

- [ ] **Step 5: Implement landscape PDF export**

Generate A4 landscape with project name, complete plan period, generated date, repeated stage labels, duration, and planned bars. Split the timeline into consecutive 31-calendar-day pages (`PDF_DAYS_PER_PAGE=31`); each page repeats project metadata and stage rows. Filename: `Gantt_Plan_<safe-project-name>_<YYYY-MM-DD>.pdf`.

- [ ] **Step 6: Run Gantt/UI syntax tests**

Run: `node --test tests/vnext-3a-gantt-ui.test.js tests/vnext-3a-project-ui.test.js && node --check public/pxl-vnext-3a-project-detail.js`
Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add public/pxl-vnext-3a-project-detail.js tests/vnext-3a-gantt-ui.test.js
git commit -m "PXL-VNEXT-3A add sequential Gantt Plan and PDF"
```

### Task 6: Full regression, migration dry-check, and deployment handoff

**Files:**
- Modify only if verification finds a Phase 3A defect.
- Test: all `tests/vnext-*.test.js` and `tests/pxl-vnext-*.test.js` plus Phase 3A tests.

**Interfaces:**
- Produces a verified implementation branch/worktree ready for user approval to push/deploy.

- [ ] **Step 1: Run all production-relevant tests**

Run: `node --test tests/vnext-*.test.js tests/pxl-vnext-*.test.js`
Expected: all PASS, including Phase 1/2 regressions and all new Phase 3A tests.

- [ ] **Step 2: Run syntax and diff checks**

Run: `node --check server.js && node --check db-core.js && node --check project-vnext-3a.js && node --check public/pxl-vnext-3a-project-detail.js && node --check public/pxl-stg-0016-project-report.js && git diff --check`
Expected: all commands exit 0.

- [ ] **Step 3: Review migration without applying it**

Verify `PXL-VNEXT-3A-MIGRATION.sql` is additive, has no destructive update/backfill, creates no Primary WO/Gantt rows for existing projects, and preserves all existing Project Report tables.

- [ ] **Step 4: Verify final diff scope**

Expected Phase 3A changes only: migration, date/service module, DB adapter, Project Tracker server routes, focused Project Detail frontend, small existing Project Report helper, account permission definitions/default, and tests. `backups/` and `public/downloads/` must remain untracked/uncommitted.

- [ ] **Step 5: Commit any verification-only fix, then stop before production actions**

If no fix is needed, do not create an empty commit. Report test counts, changed files, migration requirement, and final branch commit. Wait for explicit user authorization before GitHub push, VPS deploy, database backup/migration, process restart, or production UAT.
