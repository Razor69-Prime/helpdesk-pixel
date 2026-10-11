# PXL-VNEXT-3C Project Material Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify MR Project into approval/release control for one Primary WO Project, then limit Project Report Material `Input Today` to MR Approved + Superadmin per-item override while leaving Project Report Jasa and all Operational WO/MR flows unchanged.

**Architecture:** Keep the Project material ledger derived from existing Project BOQ, Project MR, and Project Report achievement rows; do not create a duplicate stock-project table. Add one append-only override audit table, expose ledger fields through existing Project Report responses, enforce Material usage limits server-side on achievement writes, and remove Take/Return/Use from the active MR UI while preserving historical movement data and compatibility endpoints.

**Tech Stack:** Node.js/Express, PostgreSQL/PostgREST RPCs, vanilla JavaScript frontend, Node `node:test`, existing service-worker cache/versioning.

**Spec:** `docs/superpowers/specs/2026-10-11-pxl-vnext-3c-project-material-ledger-design.md`

## Global Constraints

- One Project Tracker represents one Primary WO Project for Project material accounting; Related WO is informational only.
- Project BOQ/Project Report Item & Jasa are separate from Operational WO report Item/Jasa.
- New MR Project lines are Project BOQ `material` only; no active outside-BOQ Project MR flow.
- Jasa never enters MR Project and is never limited by MR Approved quantity.
- Active MR lifecycle is `draft -> submitted -> approved/rejected`; Take/Return/Use/Issued/Finalize are removed from the active UI.
- `Qty Approved = Qty Requested`; approval does not permit item/qty mutation.
- BOQ does not require an Inventory mapping, and Phase 3C must not perform name-based Inventory deduction.
- Material Input Today limit is `mr_approved_qty + override_qty`; validation is server-side.
- Superadmin override is per BOQ material item, positive qty, mandatory reason, and append-only/auditable.
- Synchronization uses `project_boq_item_id` / `project_report_items.id`, never material name.
- Legacy Operational MR, SO→WO, WO Ops reports, Survey flow, Inventory Ops behavior, and existing Project Report input workflow must not regress.
- Migration is additive only: no DROP/TRUNCATE/destructive rewrite of historical Project MR movement data.

## Review Focus

- **Legacy Project Report usage already above the new MR limit:** new/increased Material achievement must be blocked, but a Superadmin correction that decreases an existing achievement or edits notes must remain possible; Task 5 pins this behavior.
- **Duplicate MR lines or multiple Approved MRs for one BOQ item:** approved quantity must sum by stable BOQ item ID exactly once per qualifying MR line; Task 2 tests aggregation.
- **Old `issued`/`final` MR records with returns:** ledger contribution is `max(0, qty_requested - qty_returned)` and must not double-count old Take/Use movements; Task 2 tests compatibility.
- **Project without Primary WO:** MR creation is blocked before any MR number/draft is created, while existing Project Report remains readable; Task 3 tests this boundary.
- **Stale browser ledger values after another MR approval/override:** every Input Today write must recompute from server-side MR/override/achievement state and ignore client-supplied ledger quantities; Task 5 pins this behavior.

---

### Task 1: Add override audit storage and pure ledger rules

**Files:**
- Create: `PXL-VNEXT-3C-MIGRATION.sql`
- Create: `project-vnext-3c.js`
- Create: `tests/vnext-3c-migration.test.js`
- Create: `tests/vnext-3c-ledger-core.test.js`

**Interfaces:**
- Produces: `normalizeProjectMaterialOverrideInput(raw) -> {qty:number, reason:string}`.
- Produces: `projectMrReleaseQty(item, status) -> number` where only `approved|issued|final` contribute and historical returns reduce release quantity.
- Produces: `summarizeProjectMaterialLedger({boqItemId, materialRequests, overrides, totalDone}) -> {mr_approved_qty, override_qty, usage_limit, available_for_use}`.
- Produces DB table `project_material_usage_overrides` for Task 2/4.

- [ ] **Step 1: Write failing core tests**

Add tests asserting:
- `draft`, `submitted`, `rejected` MR lines contribute `0`.
- `approved` contributes `qty_requested`.
- legacy `issued/final` contributes `max(0, qty_requested - qty_returned)` and ignores `qty_taken/qty_used` for the new ledger.
- only rows whose `project_boq_item_id` exactly equals the requested BOQ item ID are summed.
- reversed override rows contribute `0`; active override rows sum their qty.
- `available_for_use = max(0, usage_limit - totalDone)`.
- override normalization rejects `qty <= 0`, NaN, blank reason, and accepts trimmed reason.

- [ ] **Step 2: Run the core tests and verify RED**

Run: `node --test tests/vnext-3c-ledger-core.test.js`

Expected: FAIL because `project-vnext-3c.js` does not exist.

- [ ] **Step 3: Implement `project-vnext-3c.js` minimally**

Implement only the three exported pure helpers named in **Interfaces**. Do not read DB state in this module.

- [ ] **Step 4: Run the core tests and verify GREEN**

Run: `node --test tests/vnext-3c-ledger-core.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Write failing migration tests**

`tests/vnext-3c-migration.test.js` must assert the SQL is additive and creates `project_material_usage_overrides` with:
- `id uuid primary key default gen_random_uuid()`;
- `project_id uuid not null` as an audit snapshot identifier (no cascading FK);
- `project_boq_item_id uuid not null` as an audit snapshot identifier (no cascading FK);
- `primary_work_order_ticket_id uuid null` as the Primary WO snapshot identifier;
- `item_name_snapshot text not null`;
- positive `qty numeric(14,2)`;
- non-empty `reason` check;
- `created_by_user_id`, `created_by`, `created_at`;
- nullable `reversed_at`, `reversed_by_user_id`, `reversed_by`, `reversal_reason`;
- indexes for project/BOQ lookup;
- RLS/policy following existing authenticated-access pattern;
- no DROP/TRUNCATE or mutation of legacy `material_request_forms`.

- [ ] **Step 6: Run migration test and verify RED**

Run: `node --test tests/vnext-3c-migration.test.js`

Expected: FAIL because migration does not exist.

- [ ] **Step 7: Implement additive migration**

Create only the override audit table/index/RLS objects. Do not add a duplicate Project ledger table and do not alter historical movement rows.

- [ ] **Step 8: Verify migration tests and SQL safety**

Run:
```bash
node --test tests/vnext-3c-migration.test.js tests/vnext-3c-ledger-core.test.js
grep -Ein '\b(drop|truncate)\b|material_request_forms' PXL-VNEXT-3C-MIGRATION.sql && exit 1 || true
```

Expected: tests PASS and safety grep returns no destructive match.

- [ ] **Step 9: Commit Task 1**

```bash
git add PXL-VNEXT-3C-MIGRATION.sql project-vnext-3c.js tests/vnext-3c-migration.test.js tests/vnext-3c-ledger-core.test.js
git commit -m "feat: add project material ledger core"
```

---

### Task 2: Add DB adapters and Project Report ledger aggregation

**Files:**
- Modify: `db-core.js` near Project MR / Project Report adapters and exports
- Modify: `server.js` `buildProjectReportRows()`
- Create: `tests/vnext-3c-project-report-ledger.test.js`

**Interfaces:**
- Consumes: `summarizeProjectMaterialLedger(...)` from Task 1.
- Produces: `db.getProjectMaterialRequestItemsByRequestIds(requestIds=[]) -> rows[]`, batching `project_material_request_id=in.(...)` filters in groups of at most 50 IDs.
- Produces: `db.getProjectMaterialOverrides({projectId=null,itemId=null}) -> rows[]`.
- Produces: `db.insertProjectMaterialOverride(data) -> row`.
- Produces Project Report material item fields: `mr_approved_qty`, `override_qty`, `usage_limit`, `available_for_use`.

- [ ] **Step 1: Write failing aggregation tests**

Assert `buildProjectReportRows()`:
- fetches Project MR headers once, then bulk-fetches their items through `getProjectMaterialRequestItemsByRequestIds()` plus override rows; no per-MR N+1 detail loop;
- aggregates multiple qualifying MR lines by exact `project_boq_item_id`;
- treats `approved|issued|final` according to Task 1 compatibility rule;
- ignores Draft/Submitted/Rejected, Related WO, Operational MR tables, and item-name matching;
- adds the four ledger fields only from Project data;
- leaves existing `boq_qty`, `today`, `total_done`, `remain`, `progress`, Material/Jasa summaries unchanged.

Include a fixture with two identically named BOQ items having different IDs and prove no cross-count.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3c-project-report-ledger.test.js`

Expected: FAIL because override adapters/ledger fields are absent.

- [ ] **Step 3: Add DB adapters**

In `db-core.js`, add:
- `async function getProjectMaterialRequestItemsByRequestIds(requestIds=[])` with batches of at most 50 IDs;
- `async function getProjectMaterialOverrides({projectId=null,itemId=null}={})`
- `async function insertProjectMaterialOverride(data)`

Use PostgREST table `project_material_usage_overrides`; export all three functions. No delete adapter is added in Phase 3C.

- [ ] **Step 4: Extend `buildProjectReportRows()`**

Import Task 1 helper(s). Add Project MR and override reads to the existing parallel fetch, then enrich each `category='material'` row by BOQ item ID. Jasa retains existing behavior and must not become MR-limited.

- [ ] **Step 5: Run focused tests**

Run:
```bash
node --test tests/vnext-3c-ledger-core.test.js tests/vnext-3c-project-report-ledger.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add db-core.js server.js tests/vnext-3c-project-report-ledger.test.js
git commit -m "feat: expose project material ledger in reports"
```

---

### Task 3: Simplify active MR Project creation and lifecycle

**Files:**
- Modify: `project-vnext-3b.js`
- Modify: `server.js` Project MR catalog/create/items/submit routes
- Modify: `PXL-VNEXT-3C-MIGRATION.sql` only if the existing replace-items RPC needs an additive `CREATE OR REPLACE FUNCTION` guard for BOQ-only writes
- Create: `tests/vnext-3c-project-mr-flow.test.js`

**Interfaces:**
- Produces: active MR item payload `{source_type:'boq', project_boq_item_id, qty_requested, item_name?, unit?, sort_order?}` only.
- Preserves: existing movement/finalize endpoints server-side for historical-client compatibility, but they are not part of active Phase 3C UI.

- [ ] **Step 1: Write failing MR flow tests**

Assert:
- `normalizeProjectMrItems()` rejects `inventory_extra` in Phase 3C and accepts BOQ Material without `inventory_item_id`.
- `POST /api/projects/:projectId/material-requests` checks `db.getProjectPrimaryWorkOrder(projectId)` before calling `createProjectMaterialRequest`; missing Primary WO returns `400` and creates nothing.
- catalog returns Project BOQ Material for the project; Jasa is excluded and Related WO/Operational item sources are not queried.
- submit/replace rejects a BOQ item ID belonging to another project or a Jasa row.
- Approve/Reject permission behavior from 3B6 remains unchanged, including Superadmin.
- approval payload still cannot mutate item/qty.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3c-project-mr-flow.test.js`

Expected: FAIL on outside-BOQ acceptance and missing Primary WO guard.

- [ ] **Step 3: Tighten MR item normalization**

Change `normalizeProjectMrItems()` so active writes accept only `source_type='boq'`, require `project_boq_item_id`, positive qty, and do not require/derive Inventory identity.

- [ ] **Step 4: Add Primary WO and BOQ ownership/category guards**

Before MR creation, require `db.getProjectPrimaryWorkOrder(projectId)?.ticket_id`. Before item replacement/submit, verify each BOQ ID belongs to the MR project and has `category='material'` using stable IDs.

If SQL RPC currently permits new `inventory_extra` writes independently of server validation, add an idempotent `CREATE OR REPLACE FUNCTION` delta in `PXL-VNEXT-3C-MIGRATION.sql` that enforces the same active BOQ-only rule while retaining historical rows.

- [ ] **Step 5: Verify focused MR tests plus 3B regression**

Run:
```bash
node --test tests/vnext-3c-project-mr-flow.test.js tests/vnext-3b-project-mr-api.test.js tests/vnext-3b2-project-mr-permissions.test.js tests/vnext-3b6-superadmin-approval.test.js
```

Expected: PASS after updating obsolete 3B assertions only where Phase 3C intentionally changes behavior.

- [ ] **Step 6: Commit Task 3**

```bash
git add project-vnext-3b.js server.js PXL-VNEXT-3C-MIGRATION.sql tests/vnext-3c-project-mr-flow.test.js tests/vnext-3b*.test.js
git commit -m "feat: simplify project material request flow"
```

---

### Task 4: Add Superadmin per-item override API and audit

**Files:**
- Modify: `server.js`
- Modify: `db-core.js` only if Task 2 adapter shape needs a small correction
- Create: `tests/vnext-3c-material-override-api.test.js`

**Interfaces:**
- Consumes: `normalizeProjectMaterialOverrideInput(raw)` from Task 1.
- Produces: `GET /api/project-report-items/:id/material-overrides`.
- Produces: `POST /api/project-report-items/:id/material-overrides` body `{qty,reason}`.

- [ ] **Step 1: Write failing override API tests**

Assert:
- GET requires Project Report read access and returns audit rows for that exact BOQ item.
- POST allows role `superadmin` only; Manager/Admin/Technician and delegated Project permissions receive `403`.
- POST rejects Jasa, missing item, non-positive qty, blank reason, and project without valid BOQ item identity.
- POST snapshots Project ID, BOQ item ID/name, current Primary WO ticket ID when available, qty, reason, actor user ID/name, timestamp through DB insert.
- POST writes activity log with project/item/qty context and returns refreshed ledger values.
- two sequential overrides sum; no client-provided actor/project/BOQ identity is trusted.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3c-material-override-api.test.js`

Expected: FAIL because endpoints do not exist.

- [ ] **Step 3: Implement GET/POST endpoints**

Use server-side current user, current BOQ row, and `db.getProjectPrimaryWorkOrder(item.project_id)`. POST must call normalization helper before insert. Do not implement delete; reversal remains a future explicit audited action.

- [ ] **Step 4: Verify focused tests**

Run:
```bash
node --test tests/vnext-3c-material-override-api.test.js tests/vnext-3c-project-report-ledger.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add server.js db-core.js tests/vnext-3c-material-override-api.test.js
git commit -m "feat: add superadmin project material overrides"
```

---

### Task 5: Enforce MR Approved + Override on Material Input Today

**Files:**
- Modify: `server.js` achievement POST/PATCH routes
- Modify: `project-vnext-3c.js` only if a pure `assertProjectMaterialUsage(...)` helper is needed
- Create: `tests/vnext-3c-project-usage-limit.test.js`

**Interfaces:**
- Consumes Project Report ledger fields/rules from Tasks 1–2.
- Produces server-side validation for new Material achievement and edited Material achievement.

- [ ] **Step 1: Write failing usage-limit tests**

Cover all of the following:
- Material POST succeeds when `existing_total_done + achievement <= usage_limit`.
- Material POST fails with `400` when it exceeds limit; message includes item name, MR Approved, Total Done, requested Today, and remaining allowed.
- Material with `mr_approved_qty=0` and `override_qty=0` is blocked.
- Superadmin role alone does **not** bypass the limit; an override row is required.
- after override, the same Material input succeeds up to the new limit.
- Jasa POST remains controlled only by existing BOQ Remain validation.
- PATCH of a Material achievement cannot increase the resulting total above usage limit.
- legacy Material already above limit may still be edited downward or have notes changed, so corrective edits are not trapped.
- each request reads fresh overrides/MRs/achievements before validation; no client-supplied ledger number is accepted.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3c-project-usage-limit.test.js`

Expected: FAIL because Material achievement routes currently validate BOQ only.

- [ ] **Step 3: Add one shared server-side Material limit calculation path**

Use stable `item.id` and freshly server-fetched Project MR/override/achievement state. Ignore any client-supplied `mr_approved_qty`, `override_qty`, `usage_limit`, or `available_for_use`. Keep existing BOQ Remain validation first/alongside the new usage limit. Avoid duplicating ledger math in browser code.

- [ ] **Step 4: Apply the rule to POST and PATCH**

POST blocks any Material write over limit. PATCH blocks only an increase that would worsen/introduce an over-limit result; reductions and note-only corrections remain permitted for legacy over-limit data. Jasa path remains unchanged.

- [ ] **Step 5: Run focused usage and existing Project Report tests**

Run:
```bash
node --test tests/vnext-3c-project-usage-limit.test.js tests/vnext-3c-project-report-ledger.test.js tests/vnext-3b-regression.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add server.js project-vnext-3c.js tests/vnext-3c-project-usage-limit.test.js
git commit -m "feat: enforce project material usage limits"
```

---

### Task 6: Simplify MR Project UI to approval-only material release

**Files:**
- Modify: `public/pxl-vnext-3b-project-mr.js`
- Modify: `public/pxl-vnext-3a-project-detail.js` MR helper copy if it still references Take/Return/outstanding
- Modify: `public/index.html` script cache key
- Modify: `public/sw.js` cache version
- Create: `tests/vnext-3c-project-mr-ui.test.js`
- Update: Phase 3B UI tests whose expectations are intentionally superseded

**Interfaces:**
- Consumes existing MR endpoints from Task 3.
- Produces active UI revision marker `PXL-VNEXT-3C`.

- [ ] **Step 1: Write failing UI tests**

Assert active MR UI:
- Draft/Rejected searches/selects BOQ Material only and enters Qty Requested.
- has no Inventory search, outside-BOQ flow, Take, Return, Use, Taken, Returned, Used, Outstanding, or Finalize controls/text.
- Submitted is read-only and exposes Approve/Reject according to current role/permission rules.
- Approved is read-only and shows `Qty Approved` equal to requested qty plus clear “material approved/released for Project” wording.
- historical `issued/final` records can still open read-only without movement action buttons.
- Project Detail helper copy no longer tells users to manage pengambilan/pengembalian/outstanding.

- [ ] **Step 2: Run UI test and verify RED**

Run: `node --test tests/vnext-3c-project-mr-ui.test.js`

Expected: FAIL because lifecycle controls still exist.

- [ ] **Step 3: Remove active movement UI and outside-BOQ entry**

Delete browser calls/handlers for `/movements` and `/finalize`, Inventory-at-Take state, and movement buttons. Preserve list/detail/audit rendering and submit/approve/reject behavior.

- [ ] **Step 4: Bump browser cache keys**

Set Project MR revision/query key to `PXL-VNEXT-3C` and increment service worker cache from current `pixelapps-inv1-v112` to `pixelapps-inv1-v113`. Update only intentional test expectations.

- [ ] **Step 5: Run MR UI/regression tests and syntax**

Run:
```bash
node --test tests/vnext-3c-project-mr-ui.test.js tests/vnext-3b-project-mr-requester-ui.test.js tests/vnext-3b-project-mr-lifecycle-ui.test.js
node --check public/pxl-vnext-3b-project-mr.js
node --check public/pxl-vnext-3a-project-detail.js
node --check public/sw.js
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add public/pxl-vnext-3b-project-mr.js public/pxl-vnext-3a-project-detail.js public/index.html public/sw.js tests/vnext-3c-project-mr-ui.test.js tests/vnext-3b-project-mr-*.test.js
git commit -m "feat: simplify project material request interface"
```

---

### Task 7: Show material ledger context and Superadmin override in Project Report

**Files:**
- Modify: `public/pxl-stg-0015-project-report.js`
- Modify: `public/index.html` cache key for Project Report asset if the loader is versioned there
- Modify: `public/sw.js` only if additional precache/version reference is required; keep one `v113` bump for Phase 3C
- Create: `tests/vnext-3c-project-report-ui.test.js`

**Interfaces:**
- Consumes material fields `mr_approved_qty`, `override_qty`, `usage_limit`, `available_for_use` from Task 2.
- Consumes override POST endpoint from Task 4.
- Preserves existing `saveAchievementGroup(cat, button)` interaction and existing Input Today endpoint.

- [ ] **Step 1: Write failing Project Report UI tests**

Assert:
- existing BOQ, Today, Total Done, Remain, Progress, Status, History, group Save, WhatsApp report, and PDF report controls remain present.
- Material rows show compact MR Approved, Override, and Available for Use context.
- Jasa rows do not show MR-limit/override controls.
- when `available_for_use <= 0`, Material Input Today is visually blocked/disabled with explanatory text, but server remains authoritative.
- Superadmin sees `Override Material` per Material row; other roles do not.
- override interaction asks qty, requires non-blank reason, confirms explicitly, POSTs `{qty,reason}` to exact item endpoint, refreshes Project Report, and never unlocks other items/project globally.
- existing `saveAchievementGroup('material')` continues to post achievement values through the same endpoint; no alternate Project usage endpoint is introduced.

- [ ] **Step 2: Run UI test and verify RED**

Run: `node --test tests/vnext-3c-project-report-ui.test.js`

Expected: FAIL because ledger context/override UI is absent.

- [ ] **Step 3: Add non-invasive Material context**

Extend `reportItemRow()` only for `category='material'` to show the derived ledger quantities without replacing existing Project Report columns/calculations. Keep Jasa markup/logic unchanged except shared rendering structure.

- [ ] **Step 4: Add Superadmin override action**

Implement per-item prompt/modal flow with positive qty, mandatory reason, confirmation, API POST, then refresh/re-render. Do not add a global unlock switch.

- [ ] **Step 5: Keep client-side Material max aligned with server data**

For Material only, set the UI max/disabled hint to `min(boq remain, available_for_use)`. Treat this as convenience; server validation from Task 5 remains authoritative.

- [ ] **Step 6: Run focused UI tests and syntax**

Run:
```bash
node --test tests/vnext-3c-project-report-ui.test.js tests/vnext-3c-project-usage-limit.test.js
node --check public/pxl-stg-0015-project-report.js
```

Expected: PASS.

- [ ] **Step 7: Commit Task 7**

```bash
git add public/pxl-stg-0015-project-report.js public/index.html public/sw.js tests/vnext-3c-project-report-ui.test.js
git commit -m "feat: surface project material usage controls"
```

---

### Task 8: Full regression, migration rehearsal, GitHub merge, and production rollout

**Files:**
- Update tests only if a stale assertion conflicts with the approved Phase 3C behavior; no unrelated production feature edits.

**Interfaces:**
- Consumes all previous tasks.
- Produces a production-ready `PXL-VNEXT-3C` revision with rollback evidence.

- [ ] **Step 1: Run full automated regression**

Run:
```bash
node --test tests/*.test.js
node --check server.js
node --check db-core.js
node --check project-vnext-3b.js
node --check project-vnext-3c.js
node --check public/pxl-vnext-3b-project-mr.js
node --check public/pxl-stg-0015-project-report.js
node --check public/sw.js
git diff --check origin/main...HEAD
```

Expected: all tests PASS, all syntax checks exit `0`, and diff check is clean.

- [ ] **Step 2: Run inline `public/index.html` JavaScript syntax check**

Use the repository's existing inline-script syntax checker pattern used for recent PixelApps revisions.

Expected: all inline script blocks parse successfully.

- [ ] **Step 3: Rehearse SQL migration in a transaction against production DB**

Before COMMIT deployment, run `BEGIN; \i PXL-VNEXT-3C-MIGRATION.sql` only through a safe rehearsal wrapper that ROLLBACKs, or equivalent dry-run method compatible with the migration's own transaction wrapper.

Record before/after counts for:
- `project_material_requests`;
- `project_material_request_items`;
- `project_material_request_movements`;
- `project_report_item_achievements`;
- `inventory_items`;
- inventory transaction table.

Expected: migration creates only Phase 3C schema/function objects and changes none of those business-row counts.

- [ ] **Step 4: Review branch diff before push**

Verify no changes to Operational MR/report flows, Survey, SO→WO, unrelated Inventory code, `backups/`, or `public/downloads/`.

- [ ] **Step 5: Push Phase 3C branch and run GitHub CI**

Use the established verified-patch/GitHub PR flow if direct VPS push is unavailable. Require checksum verification, full regression, syntax checks, and cleanup of any temporary workflow/patch artifact before merge.

- [ ] **Step 6: Merge only after PR diff/CI verification**

Confirm changed files match the Phase 3C plan and PR is mergeable. Squash merge into `main` with title `PXL-VNEXT-3C — Project material ledger and Input Today control`.

- [ ] **Step 7: Backup production DB and deploy migration**

Create a timestamped DB backup first. Apply `PXL-VNEXT-3C-MIGRATION.sql`, then re-check the same business-row counts. No Inventory quantity/transaction should change merely from migration.

- [ ] **Step 8: Fast-forward production source and restart app**

Require production `main` to fast-forward exactly to GitHub `origin/main`. Preserve untracked `backups/` and `public/downloads/`. Restart the existing Node service using the currently observed process-management method and verify a new process/healthy port rather than assuming restart success.

- [ ] **Step 9: Production smoke/UAT**

Verify:
1. Project with Primary WO can create BOQ-only MR; project without Primary WO is blocked.
2. Technician submits Material MR without Inventory mapping.
3. Manager/Admin/Superadmin approves; Approved view has no Take/Return/Use.
4. Material Project Report shows MR Approved and Available.
5. Material Input Today above approved amount is blocked.
6. Superadmin adds per-item override with reason; the same item can then be entered up to the new limit.
7. Another material remains blocked (override is not global).
8. Jasa Input Today behaves exactly as before.
9. Operational WO report and legacy Operational MR still work unchanged.
10. Homepage, MR JS, Project Report JS, SW return HTTP 200 and revision/cache markers are `PXL-VNEXT-3C` / `v113`.

- [ ] **Step 10: Final verification commit/status evidence**

Record GitHub `main` SHA, VPS `HEAD`, test totals, HTTP smoke results, migration result, and `git status`. Expected production status contains only the known untracked `backups/` and `public/downloads/` directories unless a separately reviewed production file exists.
