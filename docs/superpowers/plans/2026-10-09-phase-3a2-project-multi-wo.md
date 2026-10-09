# PXL-VNEXT-3A2 Project Multi-WO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Project Detail from one Primary WO to one Primary WO plus multiple existing Related WOs while enforcing one WO belongs to only one Project.

**Architecture:** Keep `project_primary_work_orders` authoritative for the single Primary WO and add an additive `project_related_work_orders` table. Enforce the cross-table one-WO-one-Project invariant both in PostgreSQL triggers and backend validation helpers. Reuse the existing compact WO search and existing Daftar WO opening flow; Project Detail never creates a WO.

**Tech Stack:** Node.js/Express, PostgreSQL 17 + PostgREST, vanilla JavaScript, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-09-phase-3a1-3a2-gantt-mobile-multi-wo-design.md`

## Global Constraints

- Execute only after `PXL-VNEXT-3A1` production UAT is accepted.
- A Project has zero/one Primary WO and zero/many Related WOs.
- A WO may belong to at most one Project across both Primary and Related relations.
- Related WOs are linked from existing WO only; no Project Detail WO creation endpoint/UI.
- Existing WO, TTD, photos, status, MR, SO→WO, and WO→MR behavior must remain untouched.
- Reuse `project_primary_wo_manage`; no new permission or role defaults.
- Unlinking a relation never deletes or edits the WO.
- No automatic relation backfill from project names.
- Expose a backend DB helper that returns all linked WO IDs for future Phase 3B MR aggregation.
- Migration is additive and reloads PostgREST schema cache.

## Review Focus

- A WO linked Primary in Project A must be rejected as Related/Primary in any other project; pin in Task 1 DB and Task 3 API tests.
- A WO linked Related in Project A must be rejected as Primary/Related elsewhere and as Related duplicate in A; pin in Task 1/3.
- Changing an existing Primary WO must release only the old Primary relation and must not alter the old WO; pin in Task 3 regression.
- Stale/deleted/unavailable WO relation must render safely and remain unlinkable; pin in Task 4 UI tests.
- Concurrent cross-table link attempts must still be rejected by database triggers even if backend pre-check races; pin migration trigger definitions in Task 1 tests.

---

### Task 1: Add Related WO persistence and cross-table database guard

**Files:**
- Create: `PXL-VNEXT-3A2-MIGRATION.sql`
- Test: `tests/vnext-3a2-multi-wo-core.test.js`

**Interfaces:**
- Produces table `project_related_work_orders`.
- Produces DB guard function `pxl_vnext_3a2_guard_project_work_order_link()` attached to both Primary and Related relation tables.

- [ ] **Step 1: Write failing migration tests**
  - Assert additive Related WO table with project FK, ticket FK, audit fields, unique `ticket_id`, and unique `(project_id,ticket_id)`.
  - Assert no insert/backfill from ticket/project-name matching.
  - Assert trigger function checks the opposite relation table before Primary or Related insert/update.
  - Assert both `project_primary_work_orders` and `project_related_work_orders` have BEFORE INSERT/UPDATE guard triggers.
  - Assert PostgREST reload notify exists.

- [ ] **Step 2: Run test and verify RED**
  - `node --test tests/vnext-3a2-multi-wo-core.test.js`

- [ ] **Step 3: Implement migration**
  - Create `project_related_work_orders(id uuid default gen_random_uuid(), project_id uuid not null, ticket_id uuid not null, created_by text, created_at timestamptz default now())` with indexes/uniques and RLS policy matching Full VPS style.
  - Guard function rules: reject if NEW.ticket_id is linked in the opposite table; on Primary update, allow the row's own existing Primary relation but reject any Related relation; on Related update/insert, reject any Primary relation or another Related owner.
  - Use clear exception text that backend can map to HTTP 409.

- [ ] **Step 4: Run test and verify GREEN**
  - Focused test PASS.

- [ ] **Step 5: Commit Task 1**
  - `git add PXL-VNEXT-3A2-MIGRATION.sql tests/vnext-3a2-multi-wo-core.test.js`
  - `git commit -m "PXL-VNEXT-3A2 add related WO relation guards"`

### Task 2: Add authoritative DB helpers for linked WOs

**Files:**
- Modify: `db-core.js:680-735` and export block
- Test: `tests/vnext-3a2-multi-wo-db.test.js`

**Interfaces:**
- Produces: `getProjectRelatedWorkOrders(projectId) -> Promise<Array<Relation>>`.
- Produces: `linkProjectRelatedWorkOrder(projectId,ticketId,actor) -> Promise<Relation>`.
- Produces: `unlinkProjectRelatedWorkOrder(projectId,ticketId) -> Promise<void>`.
- Produces: `getProjectWorkOrderOwner(ticketId) -> Promise<{project_id:string,kind:'primary'|'related'}|null>`.
- Produces: `getProjectLinkedWorkOrderIds(projectId) -> Promise<Array<string>>` returning Primary first when present, then Related, unique IDs.

- [ ] **Step 1: Write failing helper tests**
  - Assert all five helpers are exported and reference both relation tables where appropriate.
  - Assert `getProjectLinkedWorkOrderIds` de-duplicates IDs and excludes null Primary ticket IDs.

- [ ] **Step 2: Run test and verify RED**
  - `node --test tests/vnext-3a2-multi-wo-db.test.js`

- [ ] **Step 3: Implement minimal PostgREST helpers**
  - Preserve existing `getProjectPrimaryWorkOrder`/`upsertProjectPrimaryWorkOrder` signatures for compatibility.
  - Query related rows ordered by creation time.
  - `getProjectWorkOrderOwner` checks Primary first then Related and returns one normalized owner object.
  - No WO table mutation occurs in these helpers.

- [ ] **Step 4: Run test and verify GREEN**

- [ ] **Step 5: Commit Task 2**
  - `git add db-core.js tests/vnext-3a2-multi-wo-db.test.js`
  - `git commit -m "PXL-VNEXT-3A2 add Project linked WO helpers"`

### Task 3: Enforce one-WO-one-Project in APIs and add Related WO routes

**Files:**
- Modify: `server.js:1417-1480`
- Modify/Test: `tests/vnext-3a-project-api.test.js`
- Create: `tests/vnext-3a2-multi-wo-api.test.js`

**Interfaces:**
- Consumes Task 2 `getProjectWorkOrderOwner` and Related helpers.
- Extends `GET /api/projects/:id/detail` response with `related_work_orders:Array<WO|UnavailableRef>`.
- Produces `POST /api/projects/:id/related-work-orders` body `{ticket_id}`.
- Produces `DELETE /api/projects/:id/related-work-orders/:ticketId`.
- Existing `PUT /api/projects/:id/primary-work-order` now validates against both Primary and Related ownership.

- [ ] **Step 1: Write failing API tests**
  - Primary link rejects owner kind Primary or Related in another/same project as conflict when it would duplicate relation.
  - Related link rejects any existing owner, including the same project's Primary.
  - Related link requires existing Project and existing WO.
  - Link/unlink routes require `project_primary_wo_manage`.
  - DELETE only removes relation; test source must not call ticket delete/update APIs.
  - Existing SO→WO and WO→MR routes remain present.

- [ ] **Step 2: Run focused tests and verify RED**
  - `node --test tests/vnext-3a-project-api.test.js tests/vnext-3a2-multi-wo-api.test.js`

- [ ] **Step 3: Refactor Primary validation to owner helper**
  - Before Primary upsert, call `getProjectWorkOrderOwner(ticketId)`.
  - Allow the existing same-project Primary relation when selecting the currently linked WO; reject Related or another project's Primary with 409.
  - Preserve current activity logging and response shape.

- [ ] **Step 4: Add Related routes and detail aggregation**
  - Load each Related relation's WO through `getTicketById`; unavailable relations return `{unavailable:true,ticket_id}`.
  - POST checks project/ticket, checks normalized owner, inserts relation, logs `LINK RELATED WO`, returns relation+WO.
  - DELETE validates relation belongs to the current project, removes only relation, logs `UNLINK RELATED WO`.
  - Map database guard/unique exceptions to HTTP 409 with user-readable text.

- [ ] **Step 5: Run focused tests and verify GREEN**

- [ ] **Step 6: Commit Task 3**
  - `git add server.js tests/vnext-3a-project-api.test.js tests/vnext-3a2-multi-wo-api.test.js`
  - `git commit -m "PXL-VNEXT-3A2 add Related WO APIs and ownership guard"`

### Task 4: Extend Project Detail Work Order tab for Related WOs

**Files:**
- Modify: `public/pxl-vnext-3a-project-detail.js:316-390`
- Modify/Test: `tests/vnext-3a-primary-wo-ui.test.js`
- Create: `tests/vnext-3a2-multi-wo-ui.test.js`

**Interfaces:**
- Consumes detail response `related_work_orders`.
- Produces UI actions `linkRelatedWorkOrder(ticketId)` and `unlinkRelatedWorkOrder(ticketId)`.
- Reuses `GET /api/projects/:id/work-order-options` and `openTicketInList(woNumber)`.

- [ ] **Step 1: Write failing UI tests**
  - Assert Work Order tab renders a Primary WO section plus Related WO list.
  - Assert `Tambah Related WO` appears only with `project_primary_wo_manage`.
  - Assert Related search uses the existing compact options endpoint and has no WO creation POST.
  - Assert Related WO can open through existing Daftar WO flow.
  - Assert unlink requires confirmation text explicitly stating WO/history are not deleted.
  - Assert unavailable Related relation renders safely with ticket id and unlink action.

- [ ] **Step 2: Run UI tests and verify RED**
  - `node --test tests/vnext-3a-primary-wo-ui.test.js tests/vnext-3a2-multi-wo-ui.test.js`

- [ ] **Step 3: Implement Related WO list**
  - Keep current Primary section intact.
  - Render Related WOs below Primary with identifying fields: WO number/id, customer/project, type/status, technician when available.
  - Use compact cards responsive on mobile.

- [ ] **Step 4: Implement Related link/search/unlink actions**
  - Reuse existing compact WO search output; distinguish Primary-select and Related-add button handlers so one action cannot call the wrong endpoint.
  - POST Related route on add, refresh authoritative detail response.
  - DELETE Related route on confirmed unlink, refresh detail.

- [ ] **Step 5: Run UI tests and verify GREEN**

- [ ] **Step 6: Commit Task 4**
  - `git add public/pxl-vnext-3a-project-detail.js tests/vnext-3a-primary-wo-ui.test.js tests/vnext-3a2-multi-wo-ui.test.js`
  - `git commit -m "PXL-VNEXT-3A2 show Primary and Related WOs in Project Detail"`

### Task 5: Full 3A2 regression and release gate

**Files:**
- No new product code unless verification finds a defect.

- [ ] **Step 1: Full regression**
  - `node --test tests/*.test.js`
  - Expected: all tests PASS, including 3A1 and urgent MR regression tests.

- [ ] **Step 2: Syntax and diff checks**
  - `node --check db-core.js`
  - `node --check server.js`
  - `node --check public/pxl-vnext-3a-project-detail.js`
  - `git diff --check`

- [ ] **Step 3: Migration/data safety review**
  - Confirm migration creates no Related rows automatically.
  - Confirm existing Primary rows are not rewritten.
  - Confirm `projects` and `tickets` row counts are unchanged in a dry/read-only compatibility check.
  - Confirm trigger handles cross-table race defensively.

- [ ] **Step 4: Production release after explicit release instruction**
  - Backup DB/source.
  - Push verified commit, fast-forward VPS, execute migration transactionally, reload schema/restart Node, verify HTTP and PostgREST.

- [ ] **Step 5: UAT checklist**
  - Keep/set one Primary WO.
  - Add at least two existing Related WOs.
  - Attempt to link one of those WOs into another Project and verify 409/user-visible rejection.
  - Open Primary and Related WOs via existing Daftar WO flow.
  - Unlink one Related WO and verify the WO/status/history/TTD/photos remain untouched.
  - Verify `getProjectLinkedWorkOrderIds(projectId)` includes remaining Primary+Related IDs for Phase 3B readiness.

