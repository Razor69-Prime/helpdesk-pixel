# Project Internal PO Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one monitoring-only Internal PO workspace per Project with PR autofill, Project BOQ Material fast search, editable per-item supplier/quantity/actual price/status/issues, audit history, Excel/PDF export, account permission control, and Project ID visibility/search in Project Tracker.

**Architecture:** Keep Internal PO isolated from Purchase Request, Inventory, Project MR, BOQ, Project Report, and finance by storing dedicated header/items/history tables and writing the full draft through one transactional RPC. Expose small Project-scoped API endpoints and a focused browser module `public/pxl-vnext-internal-po.js` mounted into the existing Project Detail shell. Source PR/BOQ references are provenance only; saved monitoring snapshots remain independently editable.

**Tech Stack:** Node.js/Express, PostgreSQL 17 + PostgREST RPC, vanilla browser JavaScript, SheetJS/XLSX 0.18.5, jsPDF 2.5.1 + AutoTable 3.8.2, Node `node:test` + `assert/strict`.

**Spec:** `docs/superpowers/specs/2026-10-14-project-internal-po-monitoring-design.md`

## Global Constraints

- Revision identifier: `PXL-VNEXT-IPO1`.
- Baseline is latest `main`; never base implementation on the obsolete local `pxl-vnext-3d-impl` branch.
- Exactly one Internal PO monitoring workspace exists per Project; it is not a formal supplier PO and has no PO number series.
- One workspace may contain many item rows and each row may have a different supplier.
- Item add/search source is strictly current Project BOQ **Material**; never Inventory or Master Pricelist. PR import may copy every PR item even if it is not in BOQ.
- PR import is snapshot-only: all PR rows autofill, including price/supplier when present, and subsequent Internal PO edits must never write back to PR.
- Actual unit price is manual/final input; do not calculate PPN, discounts, tax-inclusive/exclusive variants, or ETA.
- `Line Total = Qty PO × Harga Beli Aktual`; blank price remains unknown and is excluded from grand total.
- Qty Arrived must be between `0` and `Qty PO`; displayed item status and overall status are server-derived.
- Internal PO must not mutate Inventory, Project MR, Project BOQ, Project Report/Input Today, Purchase Request, Supplier master, Invoice, or accounting data.
- `project_internal_po_manage` controls mutation. Project Tracker read permission controls read-only visibility; the new permission does not grant Project Tracker access by itself.
- Use soft-delete for Internal PO item rows and preserve audit history.
- Preserve production untracked directories `backups/` and `public/downloads/` during deployment.
- Any production database backup must use PostgreSQL 17 `/usr/lib/postgresql/17/bin/pg_dump`.

## Review Focus

- **Duplicate PR import:** importing the same PR twice must skip already-imported `source_pr_item_index` rows without overwriting edits; pinned in Task 1 and Task 7.
- **Tampered cross-project BOQ ID:** server must reject a BOQ source row whose ID belongs to another Project or category Jasa; pinned in Task 4.
- **Blank versus zero price:** blank price must export/display as unknown while explicit `0` remains a valid numeric value; pinned in Tasks 1 and 8.
- **Unsaved draft navigation:** changing Project Detail tab/closing Detail with dirty Internal PO edits must require confirmation and keep draft intact when navigation is cancelled; pinned in Task 6.
- **Race/concurrent save:** full-draft writes must remain atomic, and an invalid row or database error must roll back header/items/history together; pinned in Task 2 and Task 4.

---

### Task 1: Internal PO domain core

**Files:**
- Create: `project-internal-po.js`
- Create: `tests/vnext-ipo1-core.test.js`

**Interfaces:**
- Consumes: raw Internal PO item-like objects and raw Purchase Request `items` JSON entries.
- Produces: `normalizeInternalPoItem(item)`, `deriveInternalPoItemStatus(item)`, `deriveInternalPoOverallStatus(items)`, `calculateInternalPoTotals(items)`, `mapPurchaseRequestItem(item,index,pr)` and `normalizeInternalPoDraft({general_issue,items})`.

- [ ] **Step 1: Write failing domain tests**

Add tests proving exact status precedence (`Cancelled`, `Arrived`, `Partial Arrived`, `Hold`, `Ordered`, `Belum Dipesan`), overall status rules, Qty validation, line/grand totals, blank-vs-zero price behavior, PR mapping of `desc/qty/unit/price/supplier_id/supplier_name`, and duplicate provenance keys based on `source_pr_id + source_pr_item_index`.

- [ ] **Step 2: Run the new core test and verify RED**

Run: `node --test tests/vnext-ipo1-core.test.js`

Expected: FAIL because `project-internal-po.js` or required exports do not exist.

- [ ] **Step 3: Implement the minimal pure domain module**

`normalizeInternalPoDraft()` must return normalized rows plus server-recomputable values only; never trust client-supplied status/line total/grand total. Keep constants for base manual states `not_ordered|ordered|hold|cancelled` in this module so API and tests use one definition.

- [ ] **Step 4: Run the core test and verify GREEN**

Run: `node --test tests/vnext-ipo1-core.test.js`

Expected: all Task 1 tests PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add project-internal-po.js tests/vnext-ipo1-core.test.js
git commit -m "feat: add Internal PO domain core"
```

### Task 2: Additive schema and atomic save RPC

**Files:**
- Create: `PXL-VNEXT-IPO1-MIGRATION.sql`
- Create: `tests/vnext-ipo1-migration.test.js`

**Interfaces:**
- Consumes: `projects(id)`, optional provenance IDs, actor identity, full normalized items JSON.
- Produces: tables `project_internal_po`, `project_internal_po_items`, `project_internal_po_history` and RPC `pxl_vnext_internal_po_save(p_project_id uuid, p_general_issue text, p_items jsonb, p_actor_id text, p_actor_name text)`.

- [ ] **Step 1: Write failing migration contract tests**

Assert additive/idempotent DDL, one-header-per-project unique constraint, item soft-delete fields, source constraints, duplicate active PR provenance protection, history indexes, authenticated RLS/policies consistent with current project migrations, and presence of the save RPC. Explicitly assert the migration contains no `DROP TABLE`, `TRUNCATE`, or mutation of PR/Inventory/MR/BOQ tables.

- [ ] **Step 2: Run migration test and verify RED**

Run: `node --test tests/vnext-ipo1-migration.test.js`

Expected: FAIL because migration file is absent.

- [ ] **Step 3: Implement schema and transactional RPC**

The RPC must validate project existence, all rows, source shape, quantities/prices/manual states, upsert the single header, insert/update/soft-delete submitted rows, record compact history diffs, and return/enable retrieval of fresh normalized state. Any validation error must roll back the entire transaction.

- [ ] **Step 4: Add rollback and concurrency assertions**

Extend the migration test to assert the RPC is one PL/pgSQL transaction path, duplicate active PR provenance is constrained, and no partial save helper exists outside the transaction contract.

- [ ] **Step 5: Run migration test and verify GREEN**

Run: `node --test tests/vnext-ipo1-migration.test.js`

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add PXL-VNEXT-IPO1-MIGRATION.sql tests/vnext-ipo1-migration.test.js
git commit -m "feat: add Internal PO persistence"
```

### Task 3: Database adapters and normalized read model

**Files:**
- Modify: `db-core.js` near Project Tracker / Project Report adapters and `module.exports`
- Create: `tests/vnext-ipo1-db.test.js`

**Interfaces:**
- Consumes: Task 2 tables/RPC and Task 1 status/total helpers.
- Produces: `getProjectInternalPo(projectId)`, `getProjectInternalPoHistory(projectId)`, `saveProjectInternalPo(projectId,generalIssue,items,actorId,actorName)`, `searchProjectInternalPoPurchaseRequests(query,limit)`, `getProjectInternalPoBoqOptions(projectId,query,limit)`.

- [ ] **Step 1: Write failing adapter source-contract tests**

Assert exact PostgREST table/RPC names, active-item filter `deleted_at=is.null`, ordered history, PR snapshot reads from `purchase_requests.items`, BOQ option reads from `project_report_items` filtered to current `project_id` and `category=Material`, and export of all five adapters.

- [ ] **Step 2: Run adapter test and verify RED**

Run: `node --test tests/vnext-ipo1-db.test.js`

Expected: FAIL because adapters are absent.

- [ ] **Step 3: Implement adapters**

`getProjectInternalPo()` should hydrate header + active rows and call Task 1 helpers to attach displayed statuses, line totals, grand total, counts and overall status. PR search must return bounded summaries/items without widening the global PR page API. BOQ search must never query Inventory/Pricelist.

- [ ] **Step 4: Run adapter test and verify GREEN**

Run: `node --test tests/vnext-ipo1-db.test.js`

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add db-core.js tests/vnext-ipo1-db.test.js
git commit -m "feat: add Internal PO data adapters"
```

### Task 4: Project-scoped API and server permission enforcement

**Files:**
- Modify: `server.js` in Project Tracker route section
- Create: `tests/vnext-ipo1-api.test.js`

**Interfaces:**
- Consumes: Task 1 normalization/status helpers and Task 3 DB adapters.
- Produces: `GET /api/projects/:projectId/internal-po`, `GET /api/projects/:projectId/internal-po/history`, `GET /api/projects/:projectId/internal-po/purchase-requests`, `GET /api/projects/:projectId/internal-po/boq-options`, `PUT /api/projects/:projectId/internal-po`, plus server helpers `hasProjectInternalPoManage(req)` / `requireProjectInternalPoManage`.

- [ ] **Step 1: Write failing API/permission tests**

Assert read routes use existing Project read role rules; manage defaults are Superadmin, Manager, Admin, Accounting and explicit `project_internal_po_manage`; manage permission alone does not grant Project read access; PUT normalizes/recomputes server-side; BOQ option route rejects cross-project/Jasa sources; PR/BOQ support routes require manage permission; no route mutates PR/Inventory/MR/BOQ/finance.

- [ ] **Step 2: Run API test and verify RED**

Run: `node --test tests/vnext-ipo1-api.test.js`

Expected: FAIL because routes/helpers are absent.

- [ ] **Step 3: Implement permission helpers and read endpoints**

Normalize role with existing convention. Respect `custom_menus_override` semantics already used by account permissions while retaining the locked defaults from the spec.

- [ ] **Step 4: Implement support-search and atomic PUT endpoints**

Before calling `saveProjectInternalPo`, validate BOQ provenance against current Project Material rows. Log successful save in the existing activity log with Project ID/name context.

- [ ] **Step 5: Add failure-path tests**

Pin 401/403/404/400 behavior, invalid Qty Arrived, invalid negative price, cross-project BOQ tampering, malformed PR provenance, and database save failure without a second partial-write path.

- [ ] **Step 6: Run API test and verify GREEN**

Run: `node --test tests/vnext-ipo1-api.test.js`

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add server.js tests/vnext-ipo1-api.test.js
git commit -m "feat: expose Internal PO project api"
```

### Task 5: Account Management permission checklist

**Files:**
- Modify: `public/index.html` around `PROJECT_PERMISSIONS`, checkbox collection/reset/default logic
- Create: `tests/vnext-ipo1-permissions-ui.test.js`

**Interfaces:**
- Consumes: existing `custom_menus` account persistence.
- Produces: checklist item `project_internal_po_manage` labelled `🧾 Kelola Internal PO Project` and role-reset defaults matching server permission defaults.

- [ ] **Step 1: Write failing permission UI tests**

Assert the permission appears under Custom Fitur Project Tracker, participates in `allPermissionIds`, checked-menu collection, select-all/reset flows, and defaults for `superadmin`, `manager`, `admin`, and `accounting`; ensure it is not a default for Sales/Technician/Operator.

- [ ] **Step 2: Run permission UI test and verify RED**

Run: `node --test tests/vnext-ipo1-permissions-ui.test.js`

Expected: FAIL because checkbox/default is absent.

- [ ] **Step 3: Implement checklist/default integration**

Add only the permission; do not add a new sidebar menu. Keep Project Tracker access independent.

- [ ] **Step 4: Run permission UI test and verify GREEN**

Run: `node --test tests/vnext-ipo1-permissions-ui.test.js`

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add public/index.html tests/vnext-ipo1-permissions-ui.test.js
git commit -m "feat: add Internal PO account permission"
```

### Task 6: Internal PO Project Detail shell, editable table, and dirty-draft protection

**Files:**
- Create: `public/pxl-vnext-internal-po.js`
- Modify: `public/pxl-vnext-3a-project-detail.js` to add/mount the `Internal PO` tab
- Modify: `public/index.html` to load the module after Project Detail
- Create: `tests/vnext-ipo1-ui.test.js`

**Interfaces:**
- Consumes: Task 4 GET/PUT endpoints and Project Detail active `projectId`.
- Produces: `window.pxlProjectInternalPo.open(projectId,host)`, `refresh(projectId)`, `canLeave()`, `destroy()` plus rendered header/KPIs/table/general issue/save/history controls.

- [ ] **Step 1: Write failing shell/table tests**

Assert Project Detail tab order ends with `Internal PO`, module is isolated in its own file, visible table columns exactly match `No | Nama Barang | Qty PO | Qty Arrived | Satuan | Harga Beli Aktual | Total | Supplier | Status | Issue`, read-only mode hides mutation controls, issue/status visual classes exist, and no Inventory/MR write endpoint is referenced.

- [ ] **Step 2: Add dirty-navigation tests before implementation**

Assert table edits set a dirty flag; switching Project Detail tab or closing the modal calls `canLeave()`; cancelling confirmation keeps the Internal PO tab/draft; successful save clears dirty state.

- [ ] **Step 3: Run UI test and verify RED**

Run: `node --test tests/vnext-ipo1-ui.test.js`

Expected: FAIL because module/tab is absent.

- [ ] **Step 4: Implement Project Detail integration and read rendering**

The existing Project Detail file remains the shell; Internal PO owns its own state/rendering. Display Project ID/name, overall status, counts, total purchase value and general issue.

- [ ] **Step 5: Implement editable draft and one Save action**

Send the full draft to PUT only on `Simpan Perubahan`. Qty/price input should provide immediate local validation/preview but server response is authoritative after save.

- [ ] **Step 6: Implement history modal/view and dirty-draft guard**

Keep failed save drafts intact. Do not autosave.

- [ ] **Step 7: Run UI test and verify GREEN**

Run: `node --test tests/vnext-ipo1-ui.test.js`

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```bash
git add public/pxl-vnext-internal-po.js public/pxl-vnext-3a-project-detail.js public/index.html tests/vnext-ipo1-ui.test.js
git commit -m "feat: add Internal PO project detail ui"
```

### Task 7: PR autofill and BOQ Material fast search

**Files:**
- Modify: `public/pxl-vnext-internal-po.js`
- Create: `tests/vnext-ipo1-sources-ui.test.js`

**Interfaces:**
- Consumes: Task 4 PR search and BOQ options endpoints.
- Produces: PR selection modal/autocomplete that appends all not-yet-imported PR rows, and BOQ fast-search/autocomplete with the Project MR interaction pattern.

- [ ] **Step 1: Write failing source-flow tests**

Assert selecting a PR appends all item names/qty/unit/price/supplier snapshots; imported fields remain editable; same PR re-import skips existing `source_pr_item_index` rows and preserves local edits; BOQ picker searches only `/internal-po/boq-options`; there is no Inventory/Pricelist fallback; Jasa is never offered.

- [ ] **Step 2: Run source-flow test and verify RED**

Run: `node --test tests/vnext-ipo1-sources-ui.test.js`

Expected: FAIL because controls are absent.

- [ ] **Step 3: Implement searchable PR chooser and autofill**

Use bounded/debounced search. PR status is informational only. Per the approved mapping, a PR source price that is zero or missing imports as blank actual price; an explicit zero entered later by the user in Internal PO remains a valid numeric monitoring value.

- [ ] **Step 4: Implement BOQ fast search/autocomplete**

Follow Project MR keyboard/mouse suggestion behavior. Copy BOQ name/unit/id as snapshot and allow repeated BOQ source rows for split purchasing.

- [ ] **Step 5: Run source-flow test and verify GREEN**

Run: `node --test tests/vnext-ipo1-sources-ui.test.js`

Expected: PASS.

- [ ] **Step 6: Commit Task 7**

```bash
git add public/pxl-vnext-internal-po.js tests/vnext-ipo1-sources-ui.test.js
git commit -m "feat: add Internal PO source autofill"
```

### Task 8: Excel and PDF monitoring exports

**Files:**
- Modify: `public/pxl-vnext-internal-po.js`
- Create: `tests/vnext-ipo1-export.test.js`

**Interfaces:**
- Consumes: current saved/draft normalized Internal PO view and existing globals `XLSX`, `window.jspdf.jsPDF`, `doc.autoTable`.
- Produces: `exportExcel()` and `exportPdf()` with filenames `Internal-PO-<ProjectID>-YYYYMMDD.xlsx|pdf`.

- [ ] **Step 1: Write failing export contract tests**

Assert both exports contain Project ID, Project name, overall status, generated timestamp, general issue, all visible table columns and `TOTAL HARGA BELI`; PDF is landscape A4 and contains no formal supplier PO/payment/signature language; Excel keeps numeric Qty/price/total cells; blank price remains blank/unknown and explicit zero remains numeric zero.

- [ ] **Step 2: Run export test and verify RED**

Run: `node --test tests/vnext-ipo1-export.test.js`

Expected: FAIL because exporters are absent.

- [ ] **Step 3: Implement SheetJS export**

Build title/meta rows followed by monitoring table and total row. Apply currency-friendly numeric format without introducing PPN logic.

- [ ] **Step 4: Implement jsPDF + AutoTable export**

Use landscape A4, compact readable columns, repeated headers and monitoring-only title `INTERNAL PO — PROJECT MONITORING`.

- [ ] **Step 5: Run export test and verify GREEN**

Run: `node --test tests/vnext-ipo1-export.test.js`

Expected: PASS.

- [ ] **Step 6: Commit Task 8**

```bash
git add public/pxl-vnext-internal-po.js tests/vnext-ipo1-export.test.js
git commit -m "feat: export Internal PO monitoring"
```

### Task 9: Show and search Project ID in Project Tracker

**Files:**
- Modify: `public/index.html` around `filterProjects()`, `renderProjectMobileCards()`, and `renderProjectList()`
- Create: `tests/vnext-ipo1-project-id.test.js`

**Interfaces:**
- Consumes: existing `projects.project_number` from `/api/projects`.
- Produces: Project ID displayed in desktop and mobile Project Tracker and searchable by `project_number` without changing project numbering/sorting/filtering semantics.

- [ ] **Step 1: Write failing Project ID tests**

Assert desktop and mobile render `project_number`, UUID is not used as the visible Project ID fallback, search matches either `nama_project` or `project_number`, and existing Material/Jasa badges + Detail/Edit/Delete controls remain.

- [ ] **Step 2: Run Project ID test and verify RED**

Run: `node --test tests/vnext-ipo1-project-id.test.js`

Expected: FAIL because tracker does not currently render/search Project ID.

- [ ] **Step 3: Implement Project ID display/search**

Update search placeholder to mention Project ID and keep existing Project Tracker performance behavior (mobile path does not build hidden desktop rows).

- [ ] **Step 4: Run Project ID test and existing performance regression**

Run: `node --test tests/vnext-ipo1-project-id.test.js tests/vnext-3b4-project-tracker-performance.test.js`

Expected: PASS.

- [ ] **Step 5: Commit Task 9**

```bash
git add public/index.html tests/vnext-ipo1-project-id.test.js
git commit -m "feat: show Project ID in tracker"
```

### Task 10: Asset wiring, regression verification, and production-readiness package

**Files:**
- Modify: `public/index.html` cache-bust for Internal PO/Project Detail assets as needed
- Modify: `public/sw.js` if the current service-worker asset list caches Project Detail modules
- Create or modify: `tests/vnext-ipo1-wiring.test.js`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: cache-safe deployed assets and a fully verified `PXL-VNEXT-IPO1` branch ready for push/deploy.

- [ ] **Step 1: Write failing wiring/regression tests**

Assert the new browser asset is loaded after Project Detail, cache key is `PXL-VNEXT-IPO1`, service worker does not serve a stale Project Detail/Internal PO asset, and legacy Phase 3D/3D5 photo + MR hotfix assets remain wired.

- [ ] **Step 2: Run wiring test and verify RED if wiring is incomplete**

Run: `node --test tests/vnext-ipo1-wiring.test.js`

Expected: FAIL until cache wiring is current.

- [ ] **Step 3: Finish cache/service-worker wiring without unrelated refactors**

Only bump the minimum assets required for this feature. Preserve the current 3D2/3D4 asset revisions unless their files are actually changed.

- [ ] **Step 4: Run syntax checks**

Run:

```bash
node --check project-internal-po.js
node --check public/pxl-vnext-internal-po.js
node --check public/pxl-vnext-3a-project-detail.js
node --check server.js
node --check db-core.js
```

Expected: no output/errors.

- [ ] **Step 5: Run all targeted IPO1 tests**

Run: `node --test tests/vnext-ipo1-*.test.js`

Expected: all IPO1 tests PASS.

- [ ] **Step 6: Run full regression suite**

Run: `node --test tests/*.test.js`

Expected: existing 290 baseline tests plus new IPO1 tests all PASS, with zero failures.

- [ ] **Step 7: Inspect branch diff**

Run:

```bash
git status --short
git diff --check main...HEAD
git diff --stat main...HEAD
git diff --name-status main...HEAD
```

Expected: only IPO1/spec/plan-related changes; no `backups/` or `public/downloads/` content.

- [ ] **Step 8: Commit final wiring**

```bash
git add public/index.html public/sw.js tests/vnext-ipo1-wiring.test.js
git commit -m "chore: wire PXL-VNEXT-IPO1 assets"
```

- [ ] **Step 9: Production deployment gate after branch review/approval**

Before migration, create and validate a PostgreSQL 17 backup. Apply `PXL-VNEXT-IPO1-MIGRATION.sql` once, verify the three tables and RPC, deploy only the reviewed branch onto latest `main`, restart `pixelapps-node`, then run authenticated UAT covering PR autofill, BOQ-only fast search, editable name/qty/price/supplier, status/Qty Arrived, general/item issue, history, read-only permission, Excel/PDF, Project ID search, and proof that PR/Inventory/MR/BOQ/finance source data did not change.
