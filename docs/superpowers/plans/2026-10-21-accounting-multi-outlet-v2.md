# PXL-ACC-0002 — Accounting Multi-Outlet V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Accounting Sales V1 into a safe multi-outlet Accounting module for Buduk, Lukluk, and Bangli, with outlet-specific masters/transactions plus combined and per-outlet dashboard/report/export.

**Architecture:** Keep one Accounting subsystem and use `outlet_id` as the logical partition key across transactions and all Accounting masters. Preserve the existing 16-column per-outlet transaction model and formulas, while adding a read-only combined scope for reporting/export and strict server-side ownership checks on writes.

**Tech Stack:** Node.js, Express, PostgREST/PostgreSQL 17, vanilla browser JavaScript, ExcelJS, existing PixelApps session/auth shell.

**Spec:** `docs/superpowers/specs/2026-10-21-accounting-multi-outlet-v2-design.md`

## Global Constraints

- Revision code: `PXL-ACC-0002`.
- Base production commit: `a9853338fdc8a79e96421924313bf31f770ec9d1`.
- Branch: `feature/accounting-multi-outlet-v2`.
- Outlets: `Buduk`, `Lukluk`, `Bangli` with codes `BUDUK`, `LUKLUK`, `BANGLI`.
- Access remains Superadmin-only.
- `Semua Outlet` is read-only for dashboard/report/export; no transaction/master writes.
- Customer, PIC, Product Category, and Payment Method are outlet-scoped masters.
- Same master name is allowed in different outlets, but not twice in the same outlet case-insensitively.
- Existing finance formulas do not change: `DPP = round(Omzet / 1.11)`, `PPN = Omzet - DPP`, `NET = DPP - HPP`.
- Per-outlet export remains exactly 16 business columns; combined export prepends `OUTLET` for 17 columns.
- `outlet_id` cannot be changed through normal transaction edit.
- Do not read/write CRM, Sales Order, Inventory, Work Order, Project, or Invoice business data.
- Workbook injection/import is out of scope for PXL-ACC-0002.
- Migration must be additive and must not edit `PXL-ACC-0001-MIGRATION.sql`.
- Staging migration/UAT must pass before any production migration/deploy.

## Review Focus

- Existing unmapped Accounting rows: migration must abort rather than guess an outlet for existing transactions/customers/PICs.
- Cross-outlet write attempts: update/delete on a Buduk record while context is Lukluk must fail without modifying data.
- Duplicate master names: same normalized name must fail within one outlet but succeed across two outlets.
- Combined scope safety: `Semua Outlet` must never expose create/edit/delete controls and API writes must still require an explicit valid `outlet_id`.
- Export isolation: per-outlet export must contain no rows from other outlets, while combined export must identify every row with its outlet.

---

### Task 1: Add the additive multi-outlet database migration

**Files:**
- Create: `PXL-ACC-0002-MIGRATION.sql`
- Create: `tests/accounting-multi-outlet-migration.test.js`

**Interfaces:**
- Consumes: existing Accounting V1 tables created by `PXL-ACC-0001-MIGRATION.sql`.
- Produces: table `accounting_outlets`; `outlet_id` foreign keys on transactions/customers/pics/categories/payments; outlet-scoped uniqueness and transaction indexes.

- [ ] **Step 1: Write failing migration structure tests**

Add tests asserting the SQL contains: `accounting_outlets`; deterministic seeds `BUDUK/LUKLUK/BANGLI`; `outlet_id` additions to all five tables; foreign keys; transaction index including `outlet_id`; case-insensitive outlet-scoped master uniqueness; and an explicit guard that aborts when unmapped existing transaction/customer/PIC rows are present.

- [ ] **Step 2: Run the migration test and verify failure**

Run: `node tests/accounting-multi-outlet-migration.test.js`

Expected: FAIL because `PXL-ACC-0002-MIGRATION.sql` does not exist.

- [ ] **Step 3: Implement `PXL-ACC-0002-MIGRATION.sql`**

Use one transaction. Create and seed `accounting_outlets`; add nullable `outlet_id`; detect unsafe unmapped existing transactional/customer/PIC data and raise an exception rather than assigning an outlet; remove global master-name uniqueness before duplicating standard category/payment seeds to each outlet; add composite case-insensitive uniqueness; add FKs/indexes; set required `NOT NULL` only after rows are safely mapped.

- [ ] **Step 4: Run migration structure tests**

Run: `node tests/accounting-multi-outlet-migration.test.js`

Expected: PASS.

- [ ] **Step 5: Validate SQL against an isolated clone of the current production schema**

Run the migration only on the isolated staging PostgreSQL clone. Verify exactly three active outlets and no Accounting V1 table outside the intended five gains `outlet_id`.

Expected: migration PASS on a safe empty-transaction V1 clone; deliberate test fixture with unmapped transaction/customer/PIC rows aborts and rolls back.

- [ ] **Step 6: Commit**

```bash
git add PXL-ACC-0002-MIGRATION.sql tests/accounting-multi-outlet-migration.test.js
git commit -m "PXL-ACC-0002 — add multi-outlet migration"
```

### Task 2: Add outlet-aware accounting domain helpers and dashboard aggregation

**Files:**
- Modify: `accounting-sales-v1.js`
- Create: `tests/accounting-multi-outlet-core.test.js`

**Interfaces:**
- Consumes: transaction rows with `outlet_id`, `outlet_name` when supplied by routes/store.
- Produces: `normalizeOutletId(value)`, `filterTransactions(rows, filters)` with outlet support, and `aggregateAccountingDashboard(rows, options)` that can emit outlet breakdown series.

- [ ] **Step 1: Write failing core tests**

Cover: invalid/blank outlet on write normalization; filtering by `outlet_id`; existing finance formulas unchanged; same PIC name in different outlets not merged in combined outlet-aware output; combined dashboard summary equals sum of outlet summaries; `revenue_by_outlet` and `net_by_outlet` return distinct Buduk/Lukluk/Bangli buckets.

- [ ] **Step 2: Run the core tests and verify failure**

Run: `node tests/accounting-multi-outlet-core.test.js`

Expected: FAIL on missing outlet helpers/series.

- [ ] **Step 3: Implement the minimal domain changes**

Add `normalizeOutletId(value)` returning trimmed non-empty UUID-compatible input or throwing `Outlet wajib dipilih.` for write paths. Extend `filterTransactions(rows, filters)` with `filters.outlet_id`. Extend `aggregateAccountingDashboard(rows, options={})` to preserve all V1 series and add `outlet_breakdown`, `revenue_by_outlet`, and `net_by_outlet` using explicit outlet identity rather than PIC/name inference.

- [ ] **Step 4: Run core plus V1 tests**

Run:
```bash
node tests/accounting-multi-outlet-core.test.js
node tests/accounting-sales-v1.test.js
```

Expected: PASS for both.

- [ ] **Step 5: Commit**

```bash
git add accounting-sales-v1.js tests/accounting-multi-outlet-core.test.js
git commit -m "PXL-ACC-0002 — add outlet-aware accounting core"
```

### Task 3: Scope the PostgREST store by outlet and enforce ownership primitives

**Files:**
- Modify: `accounting-sales-store.js`
- Create: `tests/accounting-multi-outlet-store.test.js`

**Interfaces:**
- Consumes: `outlet_id` from route/query context.
- Produces: `listOutlets()`, outlet-aware `listTransactions(filters)`, `getTransaction(id, outletId?)`, `listMasters(type, outletId, includeInactive)`, `getMaster(type,id,outletId?)`, and write helpers that preserve row `outlet_id`.

- [ ] **Step 1: Write failing store tests with a mocked fetch/PostgREST layer**

Assert generated PostgREST queries include `outlet_id=eq.<id>` for per-outlet reads, omit that filter only for combined read scope, and use both `id` and `outlet_id` for scoped update/deactivate/delete ownership checks. Assert `accounting_outlets` is an allowed read table.

- [ ] **Step 2: Run store tests and verify failure**

Run: `node tests/accounting-multi-outlet-store.test.js`

Expected: FAIL on missing outlet table/filter behavior.

- [ ] **Step 3: Implement store interfaces**

Add `outlets:'accounting_outlets'` to `ACCOUNTING_TABLES`. Implement `listOutlets()` ordered by `sort_order,name`. Extend `txFilters(filters)` with `outlet_id`. Make `getTransaction`, `updateTransaction`, and `softDeleteTransaction` accept optional `outletId` and include it in PostgREST predicates when supplied. Extend master helpers so list/get/update/deactivate are outlet-scoped.

- [ ] **Step 4: Run store tests**

Run: `node tests/accounting-multi-outlet-store.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add accounting-sales-store.js tests/accounting-multi-outlet-store.test.js
git commit -m "PXL-ACC-0002 — scope accounting store by outlet"
```

### Task 4: Extend Accounting API for outlet context and combined read-only reporting

**Files:**
- Modify: `accounting-sales-routes.js`
- Create: `tests/accounting-multi-outlet-api.test.js`

**Interfaces:**
- Consumes: store interfaces from Task 3 and core helpers from Task 2.
- Produces: `GET /outlets`; outlet-scoped transaction/master CRUD; `GET /dashboard` with per-outlet or combined mode; `GET /export` scope metadata passed to exporter.

- [ ] **Step 1: Write failing route/API tests**

Test these cases: `GET /outlets` returns three active outlets in configured order; transaction/master POST rejects missing/invalid outlet; transaction PATCH/DELETE cannot move `outlet_id` or operate across outlet ownership; master duplicate errors remain outlet-local; classification lookup reads Customer/PIC only from the selected outlet; dashboard with `outlet_id` is scoped; dashboard `scope=all` is combined; write requests cannot use `scope=all` as an outlet substitute.

- [ ] **Step 2: Run API tests and verify failure**

Run: `node tests/accounting-multi-outlet-api.test.js`

Expected: FAIL on missing outlet route/validation.

- [ ] **Step 3: Implement outlet parsing and validation helpers**

Add exact helpers in `accounting-sales-routes.js`:
- `outletIdFromRequest(req, {required=false}={})`
- `isAllOutletScope(req)`
- `queryFilters(q={})` extended with `outlet_id`
- `applyClassification(store,input,outletId)`
- `normalizeMasterInput(type,body={},outletId)`

Writes require a valid `outlet_id`. `PATCH` must ignore/reject body attempts to change it and must use the current record outlet for normalization/ownership.

- [ ] **Step 4: Implement endpoints**

Add `GET /outlets`. Scope transaction and master reads/writes by outlet. Dashboard uses no outlet filter only for explicit combined scope. Preserve Superadmin middleware mounted outside this router.

- [ ] **Step 5: Run API and V1 regression tests**

Run:
```bash
node tests/accounting-multi-outlet-api.test.js
node tests/accounting-sales-v1.test.js
node tests/accounting-sales-export.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add accounting-sales-routes.js tests/accounting-multi-outlet-api.test.js
git commit -m "PXL-ACC-0002 — add multi-outlet accounting API"
```

### Task 5: Add combined and per-outlet Excel export

**Files:**
- Modify: `accounting-sales-export.js`
- Modify: `accounting-sales-routes.js`
- Create: `tests/accounting-multi-outlet-export.test.js`

**Interfaces:**
- Consumes: `periodRows`, outlet scope metadata, and rows carrying `outlet_name` for combined export.
- Produces: `buildAccountingWorkbook(periodRows, options={scope:'outlet'|'all', outletName:''})`.

- [ ] **Step 1: Write failing export tests**

Assert per-outlet sheets retain 16 headers `A:P`; combined sheets have 17 headers with `OUTLET` in column A and original 16 shifted to `B:Q`; per-outlet rows from another outlet never appear; combined rows include outlet name; filenames are `Accounting_<Outlet>_<period>.xlsx` and `Accounting_Semua_Outlet_<period>.xlsx`.

- [ ] **Step 2: Run export tests and verify failure**

Run: `node tests/accounting-multi-outlet-export.test.js`

Expected: FAIL because exporter has no scope options.

- [ ] **Step 3: Extend exporter**

Keep current styles/formats/freeze/filter behavior. Make column ranges, totals positions, widths, money/date formats and autofilter dynamic for 16-column outlet mode vs 17-column combined mode. Do not alter financial values.

- [ ] **Step 4: Extend export route naming and row sourcing**

Per-outlet export requires `outlet_id` and resolves outlet name from `listOutlets()`. Combined export is allowed only under `scope=all` and emits outlet identity for every row.

- [ ] **Step 5: Run export regression suite**

Run:
```bash
node tests/accounting-multi-outlet-export.test.js
node tests/accounting-sales-export.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add accounting-sales-export.js accounting-sales-routes.js tests/accounting-multi-outlet-export.test.js
git commit -m "PXL-ACC-0002 — add outlet-aware Excel export"
```

### Task 6: Add outlet selector and read-only combined mode to the Accounting UI

**Files:**
- Modify: `public/pxl-accounting-sales-v1.js`
- Create: `tests/accounting-multi-outlet-ui.test.js`

**Interfaces:**
- Consumes: `GET /api/accounting/outlets`, outlet-aware dashboard/transaction/master/export endpoints from Tasks 4–5.
- Produces: UI state `outlets`, `outletScope`, `activeOutletId`; selector `Semua Outlet | Buduk | Lukluk | Bangli`; per-outlet write controls; combined dashboard comparison charts.

- [ ] **Step 1: Write failing UI wiring tests**

Assert source contains: outlet selector; explicit `all` scope; state reset/reload on outlet change; per-outlet API query includes `outlet_id`; combined dashboard uses `scope=all`; `+ Input Transaksi` and master write actions are absent/disabled in `Semua Outlet`; combined view renders `revenue_by_outlet` and `net_by_outlet`; transaction table remains 16 columns in per-outlet mode.

- [ ] **Step 2: Run UI tests and verify failure**

Run: `node tests/accounting-multi-outlet-ui.test.js`

Expected: FAIL on missing selector/scope behavior.

- [ ] **Step 3: Extend UI state and initial load**

Update revision marker to `PXL-ACC-0002`. Add `state.outlets`, `state.outletScope='all'`, `state.activeOutletId=''`. Load outlets once when Accounting mounts. Preserve Superadmin-only gate.

- [ ] **Step 4: Add selector and context reload behavior**

Changing selector clears editing state, transaction rows, master arrays and incompatible PIC/category filters, then reloads the current section in the new context. `Semua Outlet` allows only Dashboard/report/export interactions.

- [ ] **Step 5: Scope transaction/master/dashboard/export requests**

Per-outlet calls include `outlet_id`. Combined dashboard/export use `scope=all`. Transaction/master forms never present a second outlet dropdown; they derive `outlet_id` from the active selector.

- [ ] **Step 6: Render combined dashboard outlet comparison**

Reuse the existing chart-card pattern for `Omzet per Outlet` and `NET per Outlet`; keep existing V1 charts. In combined mode, PIC/category filters must not silently use a master list from only one outlet; either hide those master-specific selectors in combined mode or populate them only from server-provided combined-safe options.

- [ ] **Step 7: Run UI and existing regression tests**

Run:
```bash
node tests/accounting-multi-outlet-ui.test.js
node tests/accounting-sales-v1.test.js
node tests/accounting-sales-export.test.js
node tests/attendance-v1-ui.test.js
node tests/attendance-v1-wiring.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add public/pxl-accounting-sales-v1.js tests/accounting-multi-outlet-ui.test.js
git commit -m "PXL-ACC-0002 — add multi-outlet Accounting UI"
```

### Task 7: Full regression, isolated staging migration, and UAT evidence

**Files:**
- Modify: `README-PXL-ACC-0001.txt` only if needed to point to PXL-ACC-0002 UAT documentation without rewriting V1 history.
- Create: `README-PXL-ACC-0002.txt`

**Interfaces:**
- Consumes: all Tasks 1–6.
- Produces: staging-tested release candidate and explicit production gate.

- [ ] **Step 1: Add PXL-ACC-0002 UAT checklist**

Document the exact checks: three outlets seeded; selector modes; combined read-only behavior; isolated masters; same-name masters across outlets; PIC isolation; transaction ownership; formulas; dashboard totals; outlet comparison charts; 16/17-column exports; unauthorized/non-Superadmin behavior unchanged; no workbook inject.

- [ ] **Step 2: Run syntax checks**

Run:
```bash
node --check accounting-sales-v1.js
node --check accounting-sales-store.js
node --check accounting-sales-routes.js
node --check accounting-sales-export.js
node --check public/pxl-accounting-sales-v1.js
node --check pxl-attendance-api.js
```

Expected: all exit 0.

- [ ] **Step 3: Run the full targeted regression suite**

Run all Accounting multi-outlet tests plus:
```bash
node tests/accounting-sales-v1.test.js
node tests/accounting-sales-export.test.js
node tests/project-status-done.test.js
node tests/attendance-v1-core.test.js
node tests/attendance-v1-api.test.js
node tests/attendance-v1-db.test.js
node tests/attendance-v1-migration.test.js
node tests/attendance-v1-permissions.test.js
node tests/attendance-v1-ui.test.js
node tests/attendance-v1-wiring.test.js
git diff --check origin/main...HEAD
```

Expected: PASS and no whitespace errors.

- [ ] **Step 4: Build isolated staging from a fresh read-only production snapshot**

Do not write to production. Restore snapshot into an isolated PostgreSQL instance, run `PXL-ACC-0002-MIGRATION.sql` there, and confirm production still has the pre-PXL-ACC-0002 schema until explicit deployment approval.

- [ ] **Step 5: Run staging API/UAT matrix**

Verify: outlet list; master isolation; transaction create/edit/delete within one outlet; cross-outlet ownership rejection; combined dashboard sum equals per-outlet totals; export isolation; unauthenticated `/api/accounting/*` remains `401`; non-Superadmin remains covered by role-gate regression/live authorized account if available.

- [ ] **Step 6: Run visual browser UAT when an authorized staging Superadmin login is available**

Verify selector behavior, hidden/disabled write controls in `Semua Outlet`, mobile/table rendering, outlet comparison charts, transaction/master forms, and downloaded Excel layout. Do not bypass authentication to manufacture this check.

- [ ] **Step 7: Commit UAT documentation**

```bash
git add README-PXL-ACC-0002.txt README-PXL-ACC-0001.txt
git commit -m "PXL-ACC-0002 — document multi-outlet UAT"
```

- [ ] **Step 8: Production gate**

Stop after staging evidence. Do not merge/deploy/migrate production until the user explicitly approves production deployment. Before production migration: backup source + PostgreSQL database; verify tracked production worktree; merge reviewed branch; run regression on merged tree; migrate database; reload Node/PostgREST; smoke-test `/api/environment`, Accounting asset, `/api/accounting/outlets`, dashboard, and export metadata.

## Self-Review Result

- Spec coverage: all sections are mapped to Tasks 1–7; workbook injection remains intentionally excluded.
- Step scan: each task has a failing test, implementation action, verification, and commit boundary.
- Interface consistency: route/store/core/export/UI names are defined before downstream use.
- Review Focus coverage: migration abort, cross-outlet ownership, duplicate-name scope, combined read-only safety, and export isolation each have explicit tests/UAT checks.
- Proportion: plan specifies interfaces and assertions without embedding implementation bodies.
