# PXL-VNEXT-3C — Project Material Ledger & Input Today Control

**Status:** Design specification for review
**Date:** 2026-10-11
**Baseline:** `main` after `PXL-VNEXT-3B6`

## 1. Goal

Simplify Project Material Request (MR Project) so it acts as authorization and record of material released for a Project WO, while Project Report `Input Today` remains the source of real field usage/progress.

The design must keep Project and Operational flows strictly separate:

- Project MR is only for Project Tracker / Primary WO Project.
- Operational WO keeps the existing Operational technician report and legacy Operational MR flow.
- Project Report Material/Jasa is project-specific BOQ data and is not the same dataset as Item/Jasa on Operational reports.

## 2. Core business model

### 2.1 One Project Tracker = one Primary WO Project

A Project Tracker row represents one Primary WO Project for Project reporting purposes.

- `primary_work_order` is the identity/reference WO for the Project.
- Creating a new MR Project requires the Project to already have a Primary WO. If no Primary WO is linked, MR creation is blocked with a clear message.
- `related_work_orders` remain informational only.
- Related WO must not contribute to BOQ, MR Project, approved material, project material usage, or Project Report progress.
- Operational WO must never be included in Project MR calculations.

### 2.2 BOQ remains the Project Report baseline

Existing `project_report_items` remains the BOQ source for Project Report.

Categories remain:

- `material`
- `jasa`

Existing Project Report / Input Today workflow stays unchanged for the technician:

- Today
- Total Done
- Remain
- Progress
- History

No Operational Item/Jasa record is copied into Project Report.

### 2.3 MR Project is material-only

MR Project may request only Project BOQ rows with `category='material'`.

Outside-BOQ Project MR lines are removed from the active Phase 3C flow. If a Project needs a new material that is not yet in BOQ, Manager/Superadmin must add that material to Project BOQ first, then the material can be requested through MR Project. This guarantees every MR material line has a stable `project_boq_item_id` and can synchronize with Input Today.

Jasa:

- is never requested through MR Project;
- is never limited by MR Approved quantity;
- continues to be progressed only through Project Report `Input Today`.

## 3. MR Project lifecycle

Active lifecycle is simplified to:

`Draft -> Diajukan -> Approved / Rejected`

Machine states remain:

- `draft`
- `submitted`
- `approved`
- `rejected`

The following Phase 3B lifecycle actions are removed from the active UI/business flow:

- Take
- Return
- Use
- Issued / Diambil
- Finalize based on outstanding movement

Historical movement data from earlier revisions must not be deleted.

### 3.1 Approval meaning

When an MR Project is approved:

- approval is all-or-nothing at MR level in Phase 3C; there is no partial per-line approval editor;
- for an approved MR line, `Qty Approved = Qty Requested`;
- every approved MR material line is treated as material released/available to that Project WO;
- the approved quantity becomes part of the Project Material Ledger;
- approval itself does not require BOQ-to-Inventory mapping;
- approval must not silently create Inventory items.

The ledger is the control source for how much Material may be recorded as real usage through Project Report `Input Today`.

## 4. Project Material Ledger

The ledger is per Project Tracker / Primary WO and per BOQ material item. It is a **derived ledger**, not a second duplicate material table: approved release quantity is calculated from Project MR item rows, override quantity from override audit rows, and real usage from existing Project Report achievements. This avoids two competing sources of truth.

Each BOQ material item exposes derived quantities:

- `boq_qty` — existing BOQ quantity.
- `mr_approved_qty` — sum of effective approved-release quantities from qualifying Project MR lines referencing the same `project_boq_item_id`; active `approved` rows contribute Qty Requested, while legacy `issued/final` rows follow the compatibility rule in section 9.
- `override_qty` — sum of active Superadmin overrides for that BOQ material item.
- `usage_limit` — `mr_approved_qty + override_qty`.
- `total_done` — existing Project Report cumulative achievement.
- `available_for_use` — `max(0, usage_limit - total_done)`.
- `remain_boq` — existing Project Report `max(0, boq_qty - total_done)`; this remains BOQ progress and is not replaced by the MR calculation.

MR Approved and BOQ Remain represent different facts and must stay separate.

Example:

- BOQ = 20
- MR Approved = 10
- Override = 2
- Total Done = 7
- Usage Limit = 12
- Available for Use = 5
- Remain BOQ = 13

## 5. Input Today validation

### 5.1 Material

Before saving a Material `Input Today` achievement, server-side validation must enforce:

`existing_total_done + new_today <= mr_approved_qty + override_qty`

If the value exceeds the limit, reject the write with a clear message containing:

- material name;
- MR Approved quantity;
- current Total Done;
- requested Today quantity;
- remaining allowed quantity.

This validation must be server-side. Browser-only blocking is insufficient.

### 5.2 Jasa

Jasa retains the existing Input Today validation only:

- value > 0;
- cannot exceed BOQ Remain according to existing Project Report behavior.

MR Project quantities do not restrict Jasa.

### 5.3 No MR Approved yet

If a Project BOQ material has `mr_approved_qty=0` and no override, Material Input Today is blocked.

The technician is not allowed to bypass this restriction.

## 6. Superadmin override

Only role `superadmin` may create a Project Material usage override.

Override scope is deliberately narrow:

- one Project;
- one `project_report_item` with category `material`;
- a positive quantity;
- mandatory reason.

An override does not unlock the entire project and does not apply to other material items.

### 6.1 Override audit fields

Additive table: `project_material_usage_overrides`.

Required fields:

- `id uuid primary key`
- `project_id uuid not null`
- `project_report_item_id uuid not null`
- `qty numeric(14,2) not null check(qty > 0)`
- `reason text not null`
- `created_by_user_id text`
- `created_by text not null`
- `created_at timestamptz not null default now()`
- `reversed_at timestamptz null`
- `reversed_by_user_id text null`
- `reversed_by text null`
- `reversal_reason text null`

Do not physically delete override audit records. A correction is recorded as a reversal, and only non-reversed override rows contribute to `override_qty`.

## 7. Inventory behavior

### 7.1 No forced BOQ -> Inventory link

Project BOQ and Inventory remain separate concepts.

A BOQ item may be fulfilled by:

- existing company Inventory;
- purchase of an item not currently represented in Inventory;
- another purchasing process outside Phase 3C.

Therefore Project MR submit/approve must not require `inventory_item_id`.

### 7.2 Stock movement scope for Phase 3C

Phase 3C removes the Take step and treats MR approval as material released for project control, but must not invent stock deduction for BOQ rows that have no Inventory identity.

To preserve stock integrity:

- legacy Operational MR stock behavior remains untouched;
- existing historical Project MR movement records remain untouched;
- Phase 3C Project Material Ledger is independent from Inventory quantity when no explicit Inventory-backed source exists;
- no name-based automatic stock deduction is allowed.

A future dedicated Purchasing/Inventory allocation feature may reconcile physical Inventory and Project Ledger if required. That is outside Phase 3C.

## 8. Data identity and synchronization

Synchronization between MR Project and Project Report must use stable IDs:

- MR line `project_boq_item_id`
- Project Report item `project_report_items.id`

Do not synchronize by material name.

Approved quantity for an item is computed from qualifying approved-release Project MR lines pointing to the same BOQ item ID, using the canonical compatibility rule in section 9.

This guarantees renamed or similarly named materials do not cross-count.

## 9. Existing MR data migration and compatibility

Phase 3C migration must be additive and preserve existing data.

Rules:

- Existing `draft`, `submitted`, `approved`, `rejected` records remain valid.
- Any legacy Draft/Rejected line without `project_boq_item_id` remains readable, but it cannot be submitted/resubmitted in Phase 3C until the user replaces it with a Project BOQ Material line.
- Existing `issued` or `final` Project MR records remain readable as historical completed/approved material release records.
- Existing movement/history tables are not dropped or truncated.
- UI no longer offers Take/Return/Use/Finalize for new active flow.
- Historical movement rows remain available read-only through existing audit/history data but must not affect new user actions.

Canonical ledger eligibility rule:

- `draft`, `submitted`, `rejected` contribute `0`.
- `approved`, `issued`, and `final` are treated as approved-release records because they all passed approval in the old lifecycle.
- effective approved quantity for each qualifying line is `max(0, qty_requested - qty_returned)` so any historical returned quantity is not counted as available project material.
- legacy `qty_taken`, `qty_used`, and movement rows remain historical audit data and are not used by the new active Input Today limit.

Current production was checked before this specification was finalized: 6 Project MR exist (1 `approved`, 5 `draft`) and there are no production `issued`/`final` Project MR records requiring movement conversion. The compatibility rule above remains defined for schema safety and future restores.

## 10. UI changes

### 10.1 MR Project

Draft/Rejected:

- select/search Project BOQ Material only;
- Qty Requested;
- no outside-BOQ Project MR line;
- Save Draft / Submit.

Submitted:

- read-only material lines;
- Approve / Reject for Manager/Admin/Superadmin or delegated approver according to current permission rules.

Approved:

- read-only;
- show `Qty Approved`;
- show status `Approved`;
- no Take, Return, Use, Outstanding, or Final button.

### 10.2 Project Report

Keep existing `Input Today` controls and workflow.

For Material rows, add non-invasive context fields or helper text:

- MR Approved
- Override
- Available for Use

Do not replace the existing columns:

- BOQ
- Today
- Total Done
- Remain
- Progress
- Status
- Today Achievement
- History

When blocked, show the reason near the affected material row.

### 10.3 Superadmin override control

Only Superadmin sees `Override Material Limit` on a Material Project Report row.

The action requires:

- Qty override;
- mandatory reason;
- explicit confirmation.

After save, Project Report refreshes and displays the new available amount.

## 11. API design

Existing achievement endpoint remains the write path for Input Today:

`POST /api/project-report-items/:id/achievements`

It gains Material usage-limit validation before insert.

New read data in Project Report response per material item:

- `mr_approved_qty`
- `override_qty`
- `usage_limit`
- `available_for_use`

Override endpoints:

- `GET /api/project-report-items/:id/material-overrides`
- `POST /api/project-report-items/:id/material-overrides`

POST is Superadmin-only and requires `{ qty, reason }`.

MR Project movement endpoints may remain server-compatible temporarily for historical clients, but new UI must not call them. A later cleanup can formally deprecate them after production confidence.

## 12. Authorization

MR Project approval defaults:

- Manager
- Admin
- Superadmin
- delegated `project_mr_approve` permission where current policy allows

Project Material override:

- Superadmin only
- no delegated permission in Phase 3C

Project Report Input Today:

- retains existing authorization;
- technicians cannot override the MR usage limit.

## 13. Notifications and audit

Keep existing Project MR submit/approve/reject notifications.

Approval audit must preserve:

- actor
- timestamp
- MR number
- item quantities

Superadmin override audit must preserve:

- Project
- Primary WO reference when available
- BOQ item ID/name snapshot
- override qty
- reason
- actor
- timestamp

Input Today history remains the real usage history.

## 14. Explicit non-goals

Phase 3C does not:

- merge Project MR with Operational MR;
- merge Project Report Item/Jasa with Operational technician report Item/Jasa;
- calculate Related WO progress;
- require Inventory mapping for BOQ;
- automatically create Inventory items from BOQ;
- build a new Purchasing module;
- redesign the existing Project Report Input Today interaction;
- change Operational WO reporting flow;
- change Sales Order -> WO flow.

## 15. Regression boundaries

Must remain unchanged:

- WO Operational classification and reporting;
- legacy Operational Material Request;
- Inventory stock behavior for legacy/Operational MR;
- Sales Order -> WO;
- Survey flow;
- Project Tracker Primary/Related WO management, except Related WO excluded from Phase 3C calculations;
- Project Report Jasa Input Today behavior;
- existing Project Report PDF/WhatsApp daily report behavior unless only additive display fields are introduced;
- Superadmin global approval behavior from PXL-VNEXT-3B6.

## 16. Acceptance criteria

1. A Project with no Primary WO cannot create a new MR Project.
2. A technician can create and submit MR Project containing BOQ Material without selecting Inventory.
3. Manager/Admin/Superadmin can approve the MR.
4. Approved MR has no Take/Return/Use action.
5. Approved MR quantities are visible as material released/approved for the Project.
6. Related WO does not contribute to Project MR or Project Report material ledger calculations.
7. Operational WO Item/Jasa and Operational MR data never enter Project ledger calculations.
8. Material Input Today succeeds when cumulative usage stays within `MR Approved + Override`.
9. Material Input Today is rejected server-side when it exceeds that limit.
10. Jasa Input Today remains unaffected by MR Approved quantities.
11. Superadmin can add a positive per-item override with mandatory reason.
12. Override affects only that BOQ material item.
13. Override is auditable and cannot be silently deleted.
14. Project Report existing BOQ/Today/Done/Remain/Progress flow remains intact.
15. Historical Project MR data and movement history remain preserved.
16. Full regression suite passes before production deployment.

## 17. Required implementation safety

Before implementation/deployment:

- use an isolated worktree/branch;
- write failing tests first for new behavior;
- inspect production `git diff` before merge/deploy;
- use additive SQL only;
- dry-run migration in a transaction with `ROLLBACK` before production commit;
- back up production DB before applying migration;
- verify Project MR counts, Project Report achievements, Inventory counts, and stock transaction counts are unchanged by migration itself;
- run full regression tests;
- verify live UI/API markers after deployment;
- preserve untracked production `backups/` and `public/downloads/`.
