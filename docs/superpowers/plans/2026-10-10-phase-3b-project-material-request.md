# PixelApps VNext Phase 3B — Project Material Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Project Material Request lifecycle tied to `project_id`, with BOQ/Inventory item sourcing, Manager/Admin approval, atomic take/return stock movement, outstanding tracking, audit history, notifications, and zero-outstanding finalization without changing MR Operasional.

**Architecture:** Keep legacy `material_request_forms` and CRM/WO MR flows untouched. Add isolated Phase 3B tables and PostgreSQL RPCs for concurrency-sensitive MR numbering, state transitions, item replacement, and stock movements; expose dedicated Express APIs through `db-core.js`; render the feature in a focused `public/pxl-vnext-3b-project-mr.js` module that can be opened from Project Detail and Project Report. All Inventory-changing operations are atomic inside PostgreSQL and every retryable movement uses an idempotency key.

**Tech Stack:** Node.js 18+, Express 4, PostgREST/PostgreSQL 17, vanilla JavaScript, existing Inventory tables/RPC conventions, existing notification service, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-10-phase-3b-project-material-request-design.md`

## Global Constraints

- MR Project is separate from MR Operasional and must not change `material_request_forms` semantics.
- Every MR Project is linked to one `project_id`; project name is read from `projects.nama_project`.
- Project number format is `PRJ-26-001`; MR Project number format is `MRP-PRJ-26-001-001` with sequence scoped per project.
- Current `projects.id` UUID remains the relational primary key; the human-readable project number is additive metadata only.
- Technician can edit items/qty only in `draft` or `rejected`; Manager/Admin approval is read-only and limited to Approve/Reject.
- Reject reason is optional.
- Approval must never change Inventory.
- Physical Take decreases `inventory_items.stock`; Return increases stock; Use changes MR quantities only.
- Partial Take/Return is supported.
- `qty_outstanding = qty_taken - qty_returned - qty_used` and may never be negative.
- Finalization is allowed only from `issued` and only when every item has `qty_outstanding = 0`.
- Material outside BOQ must reference an active Inventory item and have a non-empty additional reason.
- Take/Return stock movement and MR movement/history update must be one database transaction.
- Existing SO→WO, WO→MR Operasional, ticket completion, Inventory issue behavior, Project Tracker 3A/3A1/3A2, Gantt, BOQ, Today Achievement, TTD, photo, and remarks flows remain unchanged.
- Reuse existing warehouse permissions for physical handling: `material_request_issue` for Take; requester or accounts with `material_request_edit` may record Return/Use according to server-side ownership checks. Do not alter legacy permission defaults.
- Production migration/deployment is a separate gate after implementation and verification.

## Review Focus

- Two simultaneous draft creations for the same project must receive different sequential MR numbers and must never duplicate `MRP-...` identifiers.
- Retrying the same Take/Return operation after a network failure must not move Inventory twice; the same idempotency key returns the original result.
- A return followed by a re-take must allow net issued quantity up to `qty_requested` while cumulative `qty_taken` can exceed requested due to the return/re-take cycle.
- Serial-tracked Inventory items must not silently corrupt serial state: Phase 3B must reject physical Take/Return for `tracking_mode='serial'` until serial-number movement is explicitly supplied, while quantity-tracked items work normally.
- A technician must never be able to edit/submit another technician's MR by changing the URL/request ID; ownership checks must be server-side.

---

### Task 1: Additive Phase 3B schema, project numbering, MR domain invariants, and atomic RPCs

**Files:**
- Create: `PXL-VNEXT-3B-MIGRATION.sql`
- Create: `project-vnext-3b.js`
- Test: `tests/vnext-3b-project-mr-core.test.js`

**Interfaces:**
- Produces `normalizeProjectMrItems(rawItems)` returning normalized item rows or throwing a validation error.
- Produces `calculateProjectMrOutstanding(item)` returning `qty_taken - qty_returned - qty_used` with finite non-negative numeric validation.
- Produces SQL RPC `pxl_vnext_3b_create_project_mr(p_project_id uuid,p_actor text,p_actor_id text)` returning `{ok,id,project_id,project_number,mr_number,status}`.
- Produces SQL RPC `pxl_vnext_3b_replace_project_mr_items(p_request_id uuid,p_items jsonb,p_actor text,p_actor_id text)`.
- Produces SQL RPC `pxl_vnext_3b_transition_project_mr(p_request_id uuid,p_action text,p_actor text,p_actor_id text,p_reason text)`.
- Produces SQL RPC `pxl_vnext_3b_apply_project_mr_movement(p_request_id uuid,p_movement_type text,p_items jsonb,p_actor text,p_actor_id text,p_idempotency_key text)`.

- [ ] **Step 1: Write failing schema/domain tests**

Create tests asserting the migration is additive and contains:
- `projects.project_number` plus a unique partial index.
- `project_number_counters` or equivalent concurrency-safe allocator for `PRJ-YY-NNN`.
- `project_material_request_counters` scoped by `project_id`.
- `project_material_requests`, `project_material_request_items`, `project_material_request_movements`, `project_material_request_operations`, and `project_material_request_history`.
- Header status check limited to `draft,submitted,approved,rejected,issued,final`.
- Item source check limited to `boq,inventory_extra`, `qty_requested > 0`, cumulative quantity non-negativity, and a generated/check-protected non-negative outstanding invariant.
- Extra Inventory item reason validation.
- Unique MR number and unique idempotency key.
- RPCs named above using row locks (`FOR UPDATE`) for counter/state/stock operations.

Also assert `normalizeProjectMrItems` rejects empty list on submit validation, zero/negative/NaN quantity, `inventory_extra` without `inventory_item_id` or reason, and accepts BOQ rows with `project_boq_item_id`. Assert `calculateProjectMrOutstanding({taken:10,returned:2,used:3}) === 5` and rejects a negative result.

- [ ] **Step 2: Run core test and verify RED**

Run: `node --test tests/vnext-3b-project-mr-core.test.js`
Expected: FAIL because Phase 3B migration/domain module does not exist.

- [ ] **Step 3: Add human-readable project numbering without replacing UUIDs**

In `PXL-VNEXT-3B-MIGRATION.sql`, add `projects.project_number text` only if absent and a unique index for non-null values. Add an allocator that preserves an existing valid `PRJ-YY-NNN`; otherwise allocates the next number per two-digit year using a locked counter. Backfill existing projects deterministically by `created_at,id` inside the migration so every current project receives a stable human-readable number while `projects.id` remains unchanged.

- [ ] **Step 4: Add isolated Project MR tables and constraints**

Create:
- `project_material_requests(id,project_id,mr_number,status,created_by,created_by_user_id,submitted_by,submitted_at,approved_by,approved_at,rejected_by,rejected_at,reject_reason,finalized_by,finalized_at,created_at,updated_at)`.
- `project_material_request_items(id,project_material_request_id,source_type,project_boq_item_id,inventory_item_id,item_name_snapshot,sku_snapshot,unit_snapshot,qty_requested,qty_taken,qty_returned,qty_used,additional_reason,created_at,updated_at)`.
- `project_material_request_movements(id,project_material_request_id,project_material_request_item_id,movement_type,qty,operation_id,performed_by,performed_by_user_id,performed_at)`.
- `project_material_request_operations(id,idempotency_key unique,project_material_request_id,movement_type,performed_by,performed_at,result_json)`.
- `project_material_request_history(id,project_material_request_id,event_type,from_status,to_status,note,actor,actor_user_id,created_at)`.
- Per-project sequence/counter storage for MR suffix allocation.

Reference `projects`, `project_report_items`, and `inventory_items` with restrictive/cascade behavior appropriate to audit retention: deleting a project may cascade its Project MR data; BOQ/Inventory deletion must not erase movement history, so item snapshot columns remain authoritative for historical display.

- [ ] **Step 5: Implement create/replace/transition RPCs**

`pxl_vnext_3b_create_project_mr` must lock/allocate project number and per-project MR sequence, create `draft`, and write history. `pxl_vnext_3b_replace_project_mr_items` must lock the MR, allow only `draft/rejected`, enforce actor ownership for technician-originated records, validate BOQ/Inventory references, replace item rows atomically, and write an `items_updated` history event. `pxl_vnext_3b_transition_project_mr` must enforce exact state transitions: submit from `draft/rejected`, approve/reject from `submitted`, final from `issued` only; final must fail when any outstanding quantity is positive. Approval/rejection must not touch Inventory.

- [ ] **Step 6: Implement idempotent atomic movement RPC**

`pxl_vnext_3b_apply_project_mr_movement` accepts `take`, `return`, or `use` and a required idempotency key. It must claim the operation key before movement; a repeated key returns stored `result_json` without changing stock again. For each row lock the MR item and Inventory item when stock changes. `take` is allowed from `approved/issued`, rejects `tracking_mode='serial'` without serial support, rejects insufficient stock, and limits new take to `qty_requested - (qty_taken - qty_returned)`; it decreases Inventory, writes `inventory_transactions` type `PROJECT_MR_TAKE`, increments `qty_taken`, and changes `approved→issued` on first take. `return` and `use` reject quantities above current outstanding; Return increases Inventory and writes `PROJECT_MR_RETURN`, Use does not alter Inventory. Every movement writes the immutable movement ledger and history.

- [ ] **Step 7: Implement pure JS domain helpers**

In `project-vnext-3b.js`, export `normalizeProjectMrItems(rawItems)` and `calculateProjectMrOutstanding(item)` using decimal-safe finite Number validation for API/UI prechecks. Keep database RPCs as the final authority.

- [ ] **Step 8: Run core tests and syntax**

Run: `node --test tests/vnext-3b-project-mr-core.test.js && node --check project-vnext-3b.js`
Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add PXL-VNEXT-3B-MIGRATION.sql project-vnext-3b.js tests/vnext-3b-project-mr-core.test.js
git commit -m "PXL-VNEXT-3B add Project MR persistence and atomic lifecycle"
```

### Task 2: DB adapters, dedicated Project MR APIs, authorization, history, and notifications

**Files:**
- Modify: `db-core.js` Project/Inventory adapter sections and `module.exports`
- Modify: `server.js` Project Tracker section
- Test: `tests/vnext-3b-project-mr-api.test.js`

**Interfaces:**
- Consumes Task 1 RPCs/domain helpers.
- Produces DB methods `getProjectMaterialRequests(projectId)`, `getProjectMaterialRequest(id)`, `createProjectMaterialRequest(projectId,actor,actorId)`, `replaceProjectMaterialRequestItems(id,items,actor,actorId)`, `transitionProjectMaterialRequest(id,action,actor,actorId,reason)`, and `applyProjectMaterialRequestMovement(id,type,items,actor,actorId,idempotencyKey)`.
- Produces `GET /api/projects/:projectId/material-requests`.
- Produces `GET /api/project-material-requests/:id`.
- Produces `POST /api/projects/:projectId/material-requests`.
- Produces `PUT /api/project-material-requests/:id/items`.
- Produces `POST /api/project-material-requests/:id/submit`.
- Produces `POST /api/project-material-requests/:id/approve`.
- Produces `POST /api/project-material-requests/:id/reject`.
- Produces `POST /api/project-material-requests/:id/movements`.
- Produces `POST /api/project-material-requests/:id/finalize`.
- Produces `GET /api/projects/:projectId/material-request-catalog` returning `{project,boq_items,inventory_items}`.

- [ ] **Step 1: Write failing API/authorization tests**

Assert route presence and server-side rules:
- Project MR read/create endpoints allow authenticated Project roles plus `technician` without widening the legacy `/api/projects` role constant.
- Technician can create, replace items, and submit only their own request.
- Manager/Admin can approve/reject; Technician/Superadmin cannot approve/reject under Phase 3B.
- Approve/reject endpoints accept only action metadata; item/qty fields are ignored/rejected rather than persisted.
- `material_request_issue` is required for Take.
- Request owner or `material_request_edit` can Return/Use; ownership must be checked server-side.
- Finalization calls the transition RPC and cannot bypass outstanding validation.
- Catalog filters BOQ to material rows and Inventory to active items.
- Existing legacy MR route blocks remain present and unchanged in behavior markers.

- [ ] **Step 2: Run API test and verify RED**

Run: `node --test tests/vnext-3b-project-mr-api.test.js`
Expected: FAIL because Phase 3B DB methods/routes do not exist.

- [ ] **Step 3: Add focused DB adapters**

Implement the six adapter methods in `db-core.js` using dedicated Phase 3B tables/RPCs. `getProjectMaterialRequest(id)` returns header plus ordered items, movement ledger, history, and computed/display-ready outstanding values. Do not route Project MR through `getMRForms`, `insertMRForm`, `getCrmMaterialRequests`, or `issueInventoryMaterialRequest`.

- [ ] **Step 4: Add role/ownership helpers without modifying legacy defaults**

In `server.js`, add focused helpers for Project MR read/requester access, Manager/Admin approval, and warehouse handling. Keep `PROJECT_ROLES` and existing Material Request permission defaults unchanged. Technician mutation checks compare session user id to the stored requester id; Manager/Admin review does not grant item-edit authority.

- [ ] **Step 5: Add Project MR catalog and CRUD/state routes**

Catalog resolves the real project and project BOQ rows, returns only material BOQ items, and includes active Inventory choices for `inventory_extra`. Create delegates number allocation to the RPC. Item PUT passes normalized rows only for `draft/rejected`. Submit/Approve/Reject/Finalize are separate endpoints so state transitions cannot be smuggled through a generic PATCH.

- [ ] **Step 6: Add movement endpoint with required idempotency key**

`POST /api/project-material-requests/:id/movements` requires `{movement_type,items,idempotency_key}`. Validate `take|return|use`, positive quantities, permission/ownership, and delegate all stock/state arithmetic to the atomic RPC. Return the refreshed MR detail plus movement result.

- [ ] **Step 7: Add notifications using the existing notification helper**

After successful state/movement RPC calls, send targeted notifications without changing legacy notifications:
- submitted → Manager, Admin, Superadmin.
- approved/rejected → requester.
- take/return → requester plus Manager/Admin/Superadmin and the handling user where applicable.
- final → requester plus Manager/Admin/Superadmin.

Notification text includes project number/name, MR number, event/status, and actor. Store no notification before the underlying state change succeeds.

- [ ] **Step 8: Run API/core/regression tests and syntax**

Run: `node --test tests/vnext-3b-project-mr-core.test.js tests/vnext-3b-project-mr-api.test.js tests/vnext-3a-project-api.test.js tests/vnext-3a2-multi-wo-db.test.js && node --check db-core.js && node --check server.js`
Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```bash
git add db-core.js server.js tests/vnext-3b-project-mr-api.test.js
git commit -m "PXL-VNEXT-3B add Project MR APIs and authorization"
```

### Task 3: Technician/requester Project MR UI with BOQ-first item entry and reject-resubmit flow

**Files:**
- Create: `public/pxl-vnext-3b-project-mr.js`
- Modify: `public/index.html` script include/cache token only
- Modify: `public/pxl-vnext-3a-project-detail.js` add Material Request tab/entry hook
- Modify: `public/pxl-stg-0016-project-report.js` add technician Project MR entry point
- Test: `tests/vnext-3b-project-mr-requester-ui.test.js`
- Modify test expectation: `tests/vnext-3a-project-ui.test.js` to recognize the approved Phase 3B Material Request tab while retaining the four Phase 3A tabs

**Interfaces:**
- Produces `window.pxlProjectMr.open(projectId, requestId?)` and `window.pxlProjectMr.refresh()`.
- Extends `window.pxlProjectVnext3A` Material Request tab to call/render the new module without duplicating MR state.
- Project Report exposes a direct `Material Request Project` action for Technician so Phase 3B does not require broadening the legacy `/api/projects` Project Tracker role list.

- [ ] **Step 1: Write failing requester UI tests**

Assert:
- New module loads Project MR list and catalog for a project.
- Project name/number are read-only from API context.
- Create assigns/displays server MR number; browser never invents the sequence.
- Draft/Rejected editor prioritizes BOQ material selection.
- `Tambah Material di Luar BOQ` uses active Inventory and requires reason.
- Requested quantity must be positive.
- Submitted/Approved/Issued/Final item fields are read-only.
- Rejected request can be edited and resubmitted; reject reason may be blank.
- Technician Project Report contains an entry action into Project MR without granting Project Tracker management controls.
- Project Detail now includes exactly the prior four tabs plus `Material Request`; `Documents`/`SPJ` remain absent.

- [ ] **Step 2: Run requester UI tests and verify RED**

Run: `node --test tests/vnext-3b-project-mr-requester-ui.test.js tests/vnext-3a-project-ui.test.js`
Expected: FAIL before UI integration.

- [ ] **Step 3: Build isolated Project MR module shell/list/detail**

Create responsive modal/surface with list view and MR detail/editor. `open(projectId,requestId?)` loads the project MR list; when a request is selected, load detail and history. Show status badges for Draft, Diajukan, Approved, Rejected, Diambil, Final. Keep all API calls under the dedicated Phase 3B routes.

- [ ] **Step 4: Implement BOQ-first draft/rejected item editor**

Load `material-request-catalog`; add BOQ rows by BOQ item id and snapshot name/unit, and extra Inventory rows by inventory id plus mandatory reason. Save items through the dedicated PUT endpoint. No stock or status mutation occurs on Save.

- [ ] **Step 5: Implement Submit and reject-resubmit UX**

Submit first saves current valid items, then calls `/submit`; refresh detail/list. Rejected shows optional manager reason and re-enables item/qty editing. Resubmit uses the same `/submit` state action after successful save.

- [ ] **Step 6: Integrate Project Detail and Technician Project Report entry points**

Add `Material Request` as a Phase 3B tab in `public/pxl-vnext-3a-project-detail.js` for users already able to open Project Detail. In `public/pxl-stg-0016-project-report.js`, add the technician-safe Project MR action that calls `window.pxlProjectMr.open(projectId)` directly. Do not change BOQ editor permissions or Project Tracker CRUD permissions.

- [ ] **Step 7: Add script include/version and run requester UI tests/syntax**

Run: `node --test tests/vnext-3b-project-mr-requester-ui.test.js tests/vnext-3a-project-ui.test.js && node --check public/pxl-vnext-3b-project-mr.js && node --check public/pxl-vnext-3a-project-detail.js && node --check public/pxl-stg-0016-project-report.js`
Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add public/index.html public/pxl-vnext-3b-project-mr.js public/pxl-vnext-3a-project-detail.js public/pxl-stg-0016-project-report.js tests/vnext-3b-project-mr-requester-ui.test.js tests/vnext-3a-project-ui.test.js
git commit -m "PXL-VNEXT-3B add Project MR requester UI"
```

### Task 4: Manager/Admin approval and warehouse Take/Return/Use/Final UI

**Files:**
- Modify: `public/pxl-vnext-3b-project-mr.js`
- Test: `tests/vnext-3b-project-mr-lifecycle-ui.test.js`

**Interfaces:**
- Consumes Task 2 approval/movement/finalize APIs.
- Produces read-only Manager/Admin approval panel.
- Produces per-item movement controls and visible requested/taken/returned/used/outstanding columns.

- [ ] **Step 1: Write failing lifecycle UI tests**

Assert:
- Submitted Manager/Admin view renders item/qty fields as text/read-only and exposes only Approve/Reject actions.
- Reject reason input is optional.
- Approval does not call any movement endpoint.
- Approved/Issued view shows Requested, Taken, Returned, Used, Outstanding.
- Take requires `material_request_issue`; Return/Use is shown only when current user is requester or has `material_request_edit`.
- Movement request generates one stable idempotency key per click/operation and disables duplicate submit while pending.
- Partial Take/Return/Use refreshes values from server result, never calculates stock locally.
- Final button appears only when status is `issued` and all server outstanding values are zero.
- Serial-tracked item movement errors are displayed clearly instead of retrying blindly.

- [ ] **Step 2: Run lifecycle UI test and verify RED**

Run: `node --test tests/vnext-3b-project-mr-lifecycle-ui.test.js`
Expected: FAIL before lifecycle controls exist.

- [ ] **Step 3: Implement read-only Manager/Admin approval view**

Render project/MR metadata, item snapshots, quantities, requester, history, and Approve/Reject. Approval payload contains no item mutations. Reject sends only optional reason.

- [ ] **Step 4: Implement material movement controls**

For Approved/Issued requests, render server-authorized actions. Generate `crypto.randomUUID()` idempotency key once per user action and reuse it if the same pending request is retried. Send item id + positive qty only. Disable action controls until response resolves and refresh from returned server state.

- [ ] **Step 5: Implement outstanding/final presentation**

Show per-item and total outstanding. Final action is client-visible only when every returned item has outstanding `0`, but still delegates authoritative validation to `/finalize`. Render movement ledger/history below the item table for auditability.

- [ ] **Step 6: Run lifecycle/requester tests and syntax**

Run: `node --test tests/vnext-3b-project-mr-lifecycle-ui.test.js tests/vnext-3b-project-mr-requester-ui.test.js && node --check public/pxl-vnext-3b-project-mr.js`
Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add public/pxl-vnext-3b-project-mr.js tests/vnext-3b-project-mr-lifecycle-ui.test.js
git commit -m "PXL-VNEXT-3B add Project MR approval and material lifecycle UI"
```

### Task 5: Inventory/state integration tests, notification regression, and full Phase 3B gate

**Files:**
- Create: `tests/vnext-3b-project-mr-inventory.test.js`
- Create: `tests/vnext-3b-regression.test.js`
- Modify only if a test exposes a Phase 3B defect: Phase 3B files from Tasks 1-4

**Interfaces:**
- Verifies the complete contract; produces no new application interface.

- [ ] **Step 1: Add Inventory/state integration contract tests**

Assert migration/RPC semantics for:
- Approval leaves `inventory_items.stock` untouched.
- Take locks stock, rejects insufficient stock, reduces stock once, logs `PROJECT_MR_TAKE`, and transitions Approved→Issued.
- Same Take idempotency key cannot reduce stock twice.
- Return increases stock once and logs `PROJECT_MR_RETURN`.
- Use never changes Inventory.
- Outstanding sequence examples: take 10 → 10; use 3 → 7; return 2 → 5; re-take 2 → 7, while net issued never exceeds requested.
- Return/Use above outstanding fails.
- Final fails with outstanding >0 and succeeds only from Issued at all-zero outstanding.
- Quantity-tracked item works; serial-tracked physical movement fails with the explicit Phase 3B serial-support message.

- [ ] **Step 2: Add regression boundary tests**

Assert source still contains and preserves the existing legacy interfaces/routes used by:
- `material_request_forms`.
- `inventory_issue_material_request` / `issueInventoryMaterialRequest`.
- SO→WO.
- WO→MR Operasional.
- ticket completion.
- Project Tracker 3A/3A1/3A2 Project Detail, Gantt, Gantt templates, Primary/Related WO.

Also assert Phase 3B does not insert/update `material_request_forms` anywhere in `project-vnext-3b.js`, Phase 3B DB adapters, or Phase 3B routes.

- [ ] **Step 3: Run focused Phase 3B tests**

Run: `node --test tests/vnext-3b-project-mr-core.test.js tests/vnext-3b-project-mr-api.test.js tests/vnext-3b-project-mr-requester-ui.test.js tests/vnext-3b-project-mr-lifecycle-ui.test.js tests/vnext-3b-project-mr-inventory.test.js tests/vnext-3b-regression.test.js`
Expected: PASS.

- [ ] **Step 4: Run full existing test suite**

Run: `node --test tests/*.test.js`
Expected: all tests PASS; no pre-existing Phase 1/2/3A regression.

- [ ] **Step 5: Run syntax and inline-JS gate**

Run:
```bash
node --check server.js
node --check db-core.js
node --check project-vnext-3b.js
node --check public/pxl-vnext-3b-project-mr.js
node --check public/pxl-vnext-3a-project-detail.js
node --check public/pxl-stg-0016-project-report.js
```
Then run the repository's existing inline-JavaScript extraction/check for `public/index.html` used by prior VNext gates.
Expected: all syntax checks PASS.

- [ ] **Step 6: Review migration safety before any production execution**

Verify `PXL-VNEXT-3B-MIGRATION.sql` is additive/idempotent, has no DROP/TRUNCATE, does not rewrite legacy MR tables, preserves UUID project ids, and only backfills missing `projects.project_number`. Confirm PostgREST schema reload notification/pattern matches the current VPS migration convention.

- [ ] **Step 7: Commit verification tests/fixes**

```bash
git add tests/vnext-3b-project-mr-inventory.test.js tests/vnext-3b-regression.test.js PXL-VNEXT-3B-MIGRATION.sql project-vnext-3b.js db-core.js server.js public/index.html public/pxl-vnext-3b-project-mr.js public/pxl-vnext-3a-project-detail.js public/pxl-stg-0016-project-report.js
git commit -m "PXL-VNEXT-3B verify Project MR lifecycle and legacy regression"
```

## Final Acceptance Gate

Implementation is ready for a separate deployment decision only when:

1. Every Phase 3B focused test passes.
2. Entire `tests/*.test.js` suite passes.
3. All JavaScript syntax + `public/index.html` inline-JS checks pass.
4. Migration safety review confirms additive changes only.
5. MR Operasional route/database behavior remains unchanged.
6. A manual staging UAT confirms Draft → Diajukan → Approved/Rejected → Diambil → Final; Reject → Edit → Resubmit; partial Take/Return/Use; Inventory balance; notifications; and zero-outstanding Final gate.
7. Git diff is reviewed before production migration/deploy.
