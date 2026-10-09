# PXL-VNEXT-3A1 Gantt Template + Mobile Project Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Phase 3A Gantt defaults/PDF/template reuse and fix unreadable Project Tracker rendering on mobile without rewriting desktop Project Tracker or Project Report.

**Architecture:** Extend the existing Phase 3A Gantt module with additive shared-template persistence and API endpoints. Keep project Gantt plans authoritative and separate from templates; templates contain only name/order/duration and never a project start date. Keep the existing desktop Project Tracker table, while rendering a separate mobile card list from the same filtered `projectsData` source.

**Tech Stack:** Node.js/Express, PostgreSQL 17 + PostgREST, vanilla JavaScript, jsPDF, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-09-phase-3a1-3a2-gantt-mobile-multi-wo-design.md`

## Global Constraints

- Baseline is `PXL-VNEXT-3A` commit `c44c34e139edbc05aa0a6a6dbcc48952436fc3ba` plus the approved spec commit.
- New unsaved Gantt defaults must be exactly: Preparation, Order Barang, Amprah PLN, Tanam Tiang, Tarik Kabel FO, Instalasi Perangkat, Konfigurasi, Testing / Commissioning, Serah Terima.
- Existing saved project Gantt plans must not be rewritten or backfilled.
- Gantt calculations remain sequential calendar days including Saturday/Sunday.
- Templates store only template name, stage name, stage order, and duration; no project start date/project id in template content.
- Applying a template edits the current editor only; it never auto-saves the Project Gantt Plan.
- Reuse existing `project_gantt_manage`; do not introduce a new role/permission.
- Desktop Project Tracker remains a table; mobile Project Tracker becomes cards without horizontal scrolling.
- Do not change SO→WO, WO→MR, BOQ, Today Achievement, or Actual/Realisasi.
- Migration is additive and ends with `notify pgrst, 'reload schema';`.

## Review Focus

- Existing saved Gantt plan must win over new defaults even after the default list changes; pin this in Task 2 API/UI regression tests.
- Template names may be blank/duplicate/very long; Task 1 validates trimmed non-empty names, bounded length, and allows duplicate names only if the schema intentionally does so.
- Applying a template over an already saved plan must require explicit confirmation and still not save automatically; pin in Task 3 UI tests.
- PDF schedules longer than 31 days must preserve deterministic colors across pages; pin in Task 4 PDF tests.
- Mobile list must remain readable when issue/action text is long and when there are zero projects; pin in Task 5 responsive rendering tests.

---

### Task 1: Add shared Gantt template persistence

**Files:**
- Create: `PXL-VNEXT-3A1-MIGRATION.sql`
- Modify: `db-core.js:680-740` and export block near file end
- Test: `tests/vnext-3a1-gantt-template-core.test.js`

**Interfaces:**
- Produces: `getProjectGanttTemplates() -> Promise<Array<Template>>`
- Produces: `getProjectGanttTemplate(templateId) -> Promise<Template|null>` where `Template` includes `stages` ordered by `sort_order`.
- Produces: `createProjectGanttTemplate(name, stages, actor) -> Promise<Template>`.
- Template stage input is `{name:string,duration_days:number,sort_order:number}` only.

- [ ] **Step 1: Write failing persistence tests**
  - Assert migration creates `project_gantt_templates` and `project_gantt_template_stages` additively.
  - Assert template stages do not contain `start_date`, `planned_start`, `planned_end`, or `project_id` as project-specific state beyond the template FK.
  - Assert migration contains no update/insert against existing `project_gantt_plans` or `project_gantt_stages`.
  - Assert `db-core.js` exposes the three interfaces above.

- [ ] **Step 2: Run the focused test and verify RED**
  - Run: `node --test tests/vnext-3a1-gantt-template-core.test.js`
  - Expected: FAIL because 3A1 migration/helpers do not exist.

- [ ] **Step 3: Implement additive template schema**
  - `project_gantt_templates`: UUID id, `name` text non-empty with max 120 chars, created/updated actor/timestamps.
  - `project_gantt_template_stages`: UUID id, template FK cascade, non-empty name, `duration_days` 1..3650, `sort_order`, audit metadata, unique `(template_id,sort_order)`.
  - Add RLS/policy following 3A Full VPS pattern; no Supabase-role grants.
  - Add an atomic `pxl_vnext_3a1_create_gantt_template(p_name,p_stages,p_actor)` RPC that validates 1..100 stages and inserts header+stages in one transaction.
  - End migration with PostgREST schema reload notify.

- [ ] **Step 4: Implement DB helpers**
  - Read templates ordered newest/name consistently.
  - Read one template with ordered stages.
  - Create template through the RPC and return the freshly loaded template.

- [ ] **Step 5: Run focused test and verify GREEN**
  - Run: `node --test tests/vnext-3a1-gantt-template-core.test.js`
  - Expected: PASS.

- [ ] **Step 6: Commit Task 1**
  - `git add PXL-VNEXT-3A1-MIGRATION.sql db-core.js tests/vnext-3a1-gantt-template-core.test.js`
  - `git commit -m "PXL-VNEXT-3A1 add shared Gantt template persistence"`

### Task 2: Update nine-stage defaults and template APIs

**Files:**
- Modify: `project-vnext-3a.js:3-13`
- Modify: `server.js:1417-1505`
- Test: `tests/vnext-3a-project-core.test.js`
- Create: `tests/vnext-3a1-gantt-template-api.test.js`

**Interfaces:**
- Consumes Task 1 DB helpers.
- Produces: `GET /api/project-gantt-templates` under existing Project read role protection.
- Produces: `POST /api/project-gantt-templates` under `project_gantt_manage`.
- Existing `GET /api/projects/:id/gantt-plan` keeps returning `{plan,default_stages}`; `default_stages` becomes the approved nine-stage array only when no saved plan is being edited by the client.

- [ ] **Step 1: Update tests first**
  - Change the Phase 3A default-stage regression from seven to the exact approved nine-stage order.
  - Add API tests proving GET is read-protected and POST is permission-protected.
  - Assert POST accepts `{name,stages:[{name,duration_days,sort_order}]}` and rejects blank names/invalid stage counts/durations.
  - Assert no route mutates existing project Gantt plans when creating a template.

- [ ] **Step 2: Run tests and verify RED**
  - Run: `node --test tests/vnext-3a-project-core.test.js tests/vnext-3a1-gantt-template-api.test.js`
  - Expected: FAIL on old seven-stage defaults and missing template routes.

- [ ] **Step 3: Implement exact nine-stage defaults**
  - Replace only `DEFAULT_PROJECT_GANTT_STAGES`; leave `buildSequentialGanttPlan()` behavior unchanged.

- [ ] **Step 4: Implement template API endpoints**
  - GET returns shared templates with stage layouts.
  - POST validates request using existing server-side Gantt duration/name limits before calling Task 1 DB helper.
  - Use `req.session.user.name` for audit actor and `logActivity()` with a Project/Gantt template action.

- [ ] **Step 5: Run tests and verify GREEN**
  - Run the two focused test files; expected PASS.

- [ ] **Step 6: Commit Task 2**
  - `git add project-vnext-3a.js server.js tests/vnext-3a-project-core.test.js tests/vnext-3a1-gantt-template-api.test.js`
  - `git commit -m "PXL-VNEXT-3A1 expose nine-stage defaults and template API"`

### Task 3: Add Save As Template and Apply Template UI

**Files:**
- Modify: `public/pxl-vnext-3a-project-detail.js:140-256`
- Test: `tests/vnext-3a1-gantt-template-ui.test.js`

**Interfaces:**
- Consumes `GET/POST /api/project-gantt-templates`.
- Produces UI functions: `loadGanttTemplates()`, `saveCurrentGanttAsTemplate()`, `applyGanttTemplate(templateId)`.
- Applying template updates `state.ganttStages` only; `state.ganttStartDate` remains the current project's value.

- [ ] **Step 1: Write failing UI tests**
  - Assert buttons/text `Simpan Sebagai Template` and `Pakai Template` exist only for `project_gantt_manage` mutation actions.
  - Assert save-template payload excludes start date/project id.
  - Assert apply-template retains the current start date and calls no `PUT /projects/:id/gantt-plan`.
  - Assert applying when `state.data.gantt_plan.stages.length > 0` requires `confirm()` before replacing editor stages.
  - Assert `Simpan Gantt Plan` remains the only action that persists the project plan.

- [ ] **Step 2: Run UI test and verify RED**
  - Run: `node --test tests/vnext-3a1-gantt-template-ui.test.js`

- [ ] **Step 3: Implement template picker/save UX**
  - Load shared templates when Gantt editor opens.
  - `Simpan Sebagai Template` prompts for a trimmed template name, posts the current stage name/order/duration layout, refreshes template list, and does not alter project plan.
  - `Pakai Template` uses a select/picker from shared templates; confirm if a saved project plan exists; replace editor stages only, recalculate preview from the project's current start date, and wait for explicit `Simpan Gantt Plan`.
  - Include the nine-stage default as a non-DB system option in the picker so it is not duplicated per project.

- [ ] **Step 4: Run UI test and verify GREEN**
  - Run focused UI test; expected PASS.

- [ ] **Step 5: Commit Task 3**
  - `git add public/pxl-vnext-3a-project-detail.js tests/vnext-3a1-gantt-template-ui.test.js`
  - `git commit -m "PXL-VNEXT-3A1 add reusable Gantt template controls"`

### Task 4: Make Gantt PDF colored and deterministic

**Files:**
- Modify: `public/pxl-vnext-3a-project-detail.js:256-313`
- Modify/Test: `tests/vnext-3a-gantt-ui.test.js`

**Interfaces:**
- Produces local deterministic helper `ganttStageColor(index)` returning one entry from a fixed printable RGB palette.
- Existing `downloadGanttPdf()` remains landscape A4 and 31-day page chunks.

- [ ] **Step 1: Write failing PDF tests**
  - Assert a palette of at least 6 distinct colors exists.
  - Assert each stage bar calls `doc.setFillColor(...)` before drawing the bar.
  - Assert stage color is based on stage index/order so the same stage keeps the same color on every PDF page.
  - Preserve assertions for landscape A4 and 31-day pagination.

- [ ] **Step 2: Run test and verify RED**
  - Run: `node --test tests/vnext-3a-gantt-ui.test.js`

- [ ] **Step 3: Implement printable color palette**
  - Use fixed medium/dark RGB colors with readable contrast; do not randomize.
  - Reset text/grid colors explicitly after drawing bars so later cells/pages are not tinted accidentally.

- [ ] **Step 4: Run test and verify GREEN**
  - Run focused test; expected PASS.

- [ ] **Step 5: Commit Task 4**
  - `git add public/pxl-vnext-3a-project-detail.js tests/vnext-3a-gantt-ui.test.js`
  - `git commit -m "PXL-VNEXT-3A1 colorize Gantt PDF report"`

### Task 5: Replace mobile Project Tracker table with cards

**Files:**
- Modify: `public/index.html:312-350` CSS
- Modify: `public/index.html:2109-2120` markup
- Modify: `public/index.html:10301-10365` renderer
- Create: `tests/vnext-3a1-project-mobile-ui.test.js`

**Interfaces:**
- Produces mobile container `#proj-mobile-list` sourced from the same `filterProjects()` result.
- Produces helper `renderProjectMobileCards(filtered)` returning/rendering compact cards.
- Desktop table remains `#proj-table-body` and existing Edit/Delete behavior is not removed.

- [ ] **Step 1: Write failing responsive UI tests**
  - Assert mobile container/card classes exist.
  - Assert media CSS hides `.proj-table-wrap` and shows mobile cards only at mobile width, while desktop does the inverse.
  - Assert card contains priority/name, status, PIC, Material/Jasa progress, target, latest issue, action plan, and Detail.
  - Assert issue/action text uses line clamping or bounded wrapping and does not force horizontal scroll.
  - Assert empty filtered results render a mobile empty-state as well as desktop empty row.

- [ ] **Step 2: Run test and verify RED**
  - Run: `node --test tests/vnext-3a1-project-mobile-ui.test.js`

- [ ] **Step 3: Add mobile-only markup/CSS**
  - Keep desktop/table styles intact.
  - Add card styles under the Project Tracker section and a mobile breakpoint matching the current app's phone layout.

- [ ] **Step 4: Render mobile cards from the same filtered data**
  - Call `renderProjectMobileCards(filtered)` from `renderProjectList()` after summary calculation.
  - Reuse `window.pxlProjectReportSummaries` for Material/Jasa progress and existing permission checks for actions.
  - Detail remains the primary action; Edit/Delete may remain as compact secondary actions if already allowed.

- [ ] **Step 5: Run test and verify GREEN**
  - Run focused mobile test; expected PASS.

- [ ] **Step 6: Commit Task 5**
  - `git add public/index.html tests/vnext-3a1-project-mobile-ui.test.js`
  - `git commit -m "PXL-VNEXT-3A1 fix Project Tracker mobile cards"`

### Task 6: Full 3A1 verification and release gate

**Files:**
- No new product code unless verification reveals a defect.

- [ ] **Step 1: Run complete regression**
  - Run: `node --test tests/*.test.js`
  - Expected: all tests PASS, including existing 3A tests intentionally updated only for nine-stage default.

- [ ] **Step 2: Run syntax/diff checks**
  - `node --check project-vnext-3a.js`
  - `node --check db-core.js`
  - `node --check server.js`
  - `node --check public/pxl-vnext-3a-project-detail.js`
  - Extract/check inline JS from `public/index.html` using the repository's existing syntax-check pattern.
  - `git diff --check` must be clean.

- [ ] **Step 3: Migration safety review**
  - Confirm 3A1 migration has no backfill/update of saved project Gantt plans.
  - Confirm Full VPS PostgREST reload notify is present.
  - Confirm no new permission defaults.

- [ ] **Step 4: Production release sequence after explicit release instruction**
  - Backup DB/source.
  - Push verified commit to GitHub.
  - Fast-forward VPS only.
  - Run 3A1 migration transactionally.
  - Restart/reload Node/PostgREST as required.
  - Verify public/local HTTP, new template tables/API, row counts, and full regression.

- [ ] **Step 5: UAT checklist**
  - New unsaved Gantt shows the exact nine stages.
  - Existing saved Gantt remains unchanged.
  - Save a layout as template; apply it to a second project; second project keeps its own start date and requires explicit Save Plan.
  - PDF displays colored stage bars across pages.
  - Project Tracker on phone renders cards with no overlapping columns.

