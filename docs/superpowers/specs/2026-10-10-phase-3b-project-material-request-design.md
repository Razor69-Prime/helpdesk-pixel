# Phase 3B — Project Material Request Design

Date: 2026-10-10
Baseline: `ea0f84bd82eeb85a207b8300e61de1857093d49b` (`PXL-VNEXT-3A2 multi-WO project and one-page Gantt PDF`)
Status: Approved design, written specification

## 1. Goal

Phase 3B adds a dedicated **Material Request Project (MR Project)** flow for projects in Project Tracker. The new flow must be linked directly to `project_id`, support multiple MR per project, preserve an auditable material lifecycle, and move Inventory only when material physically leaves or returns to the warehouse.

This module is intentionally isolated from the existing/legacy MR Operasional flow. Existing SO→WO, WO→MR Operasional, ticket completion, and current `material_request_forms` behavior must remain unchanged.

## 2. Core Rules

- MR Project is a separate module and data flow from MR Operasional.
- Every MR Project is linked to one `project_id`.
- Project name is read from the linked project and is not manually typed into the MR.
- One project may have multiple MR Project records.
- Existing project number format remains `PRJ-26-001`.
- MR Project number format is `MRP-PRJ-26-001-001`, where the last three digits are a sequence within the project.
- Sequence allocation must be concurrency-safe so two simultaneous submissions cannot receive the same MR number.

## 3. Roles and Permissions

### Technician

- Can create MR Project for an accessible project.
- Can edit MR only while status is `Draft` or `Rejected`.
- Can add material from the project BOQ.
- Can add material outside BOQ by selecting an existing Inventory item, but an additional-material reason is mandatory.
- Can submit MR for approval.
- Cannot approve or reject.

### Manager / Admin

- Can review submitted MR Project.
- Can only choose `Approve` or `Reject` during approval review.
- Cannot modify requested items or quantities during approval.
- If a change is required, the MR must be rejected; the technician edits it and submits again.
- Reject reason is optional.

### Superadmin

- Receives MR Project notifications and can monitor the records.
- Does not receive an Approve/Reject action in Phase 3B. Approval and rejection are restricted to Manager/Admin.

### User Pengambil Material

- Material pickup and return actions are recorded against the authenticated user handling the transaction.
- The pickup user is included in relevant notifications/history.

## 4. Status Lifecycle

Canonical lifecycle:

`Draft → Diajukan → Approved / Rejected → Diambil → Final`

Technical status values should be stable machine values while UI labels remain Indonesian. Recommended values:

- `draft` → Draft
- `submitted` → Diajukan
- `approved` → Approved
- `rejected` → Rejected
- `issued` → Diambil
- `final` → Final

Allowed transitions:

- `draft → submitted`: technician submits.
- `submitted → approved`: Manager/Admin approves.
- `submitted → rejected`: Manager/Admin rejects.
- `rejected → submitted`: technician edits as needed and resubmits.
- `approved → issued`: at least one approved material quantity is physically taken from Inventory.
- `issued → final`: allowed only when every item has zero outstanding quantity.

No item/quantity mutation is allowed in `submitted`, `approved`, `issued`, or `final` through the approval UI.

## 5. Material Sources

Each MR item records its source:

- `boq`: material originated from Project BOQ.
- `inventory_extra`: material was added outside BOQ from existing Inventory.

For `inventory_extra`:

- `inventory_item_id` is required.
- A non-empty `additional_reason` is required before submit.

For BOQ items, implementation should retain the source BOQ item identifier where available so future reports can compare requested/used material against the project BOQ without relying only on material names.

## 6. Quantity Model and Inventory Movement

Per MR item, track at minimum:

- `qty_requested`
- `qty_taken`
- `qty_returned`
- `qty_used`
- `qty_outstanding`

Invariant:

`qty_outstanding = qty_taken - qty_returned - qty_used`

and it must never be negative.

Inventory behavior:

- **Approval does not change Inventory.**
- **Take / Diambil** decreases Inventory by the quantity physically taken.
- **Return / Dikembalikan** increases Inventory by the quantity physically returned.
- Marking material as **used/terpakai** does not change Inventory because stock was already reduced when it was taken.
- Every take/return operation must be transaction-safe and idempotent enough to prevent double stock movement on retries.
- Outstanding quantity must always be visible in MR Project detail after issuance.
- MR Project can become `Final` only when all item `qty_outstanding = 0`.

Partial pickup and partial return are supported. An MR can remain `issued` while outstanding material exists.

## 7. Data Isolation

To protect the existing MR Operasional flow, Phase 3B should use dedicated additive tables rather than changing legacy MR semantics.

Recommended tables:

### `project_material_requests`

Header data, including:

- `id`
- `project_id`
- `mr_number`
- `status`
- `created_by`
- `submitted_by`, `submitted_at`
- `approved_by`, `approved_at`
- `rejected_by`, `rejected_at`, `reject_reason`
- `finalized_by`, `finalized_at`
- timestamps

### `project_material_request_items`

Item data, including:

- `id`
- `project_material_request_id`
- `source_type`
- `project_boq_item_id` nullable
- `inventory_item_id`
- material snapshot fields needed for audit/display
- `qty_requested`
- `qty_taken`
- `qty_returned`
- `qty_used`
- `additional_reason` nullable/required for `inventory_extra`
- timestamps

### `project_material_request_movements`

Immutable movement ledger for physical stock events:

- `id`
- `project_material_request_id`
- `project_material_request_item_id`
- `movement_type` (`take` / `return` / `use`)
- `qty`
- `performed_by`
- `performed_at`
- transaction/reference metadata

### `project_material_request_history`

Audit history for status and meaningful MR events, including actor, timestamp, previous/new status, and optional note/reason.

All schema changes are additive. Existing `material_request_forms` and existing MR Operasional routes remain untouched unless a shared inventory primitive can be reused without changing their behavior.

## 8. API Boundaries

Phase 3B should expose dedicated Project MR endpoints, separate from legacy MR endpoints. The exact route prefix should follow current server conventions, but responsibilities are:

- list MR Project by project
- get MR Project detail
- create draft
- update draft/rejected MR items
- submit
- approve
- reject
- record material take
- record material return
- record material use/consumption
- finalize after zero-outstanding validation
- fetch status/history/movement detail

Server-side authorization is mandatory for every state-changing action; UI hiding alone is not sufficient.

## 9. UI Integration

MR Project is surfaced from Project Tracker / Project Detail, not mixed into the existing MR Operasional list.

Project detail should provide:

- MR Project list for the selected project
- MR number and status
- creator/PIC and important timestamps
- item counts/quantities
- outstanding indicator after material has been taken
- action buttons permitted by current role and status

Technician create/edit screen should prioritize BOQ materials but also provide an explicit **Tambah Material di Luar BOQ** action that selects from Inventory and requires a reason.

Approval view must be read-only for material and quantity fields, with only Approve/Reject actions for Manager/Admin.

## 10. Notifications

Relevant status/event notifications must cover:

- Manager
- Admin
- Superadmin
- technician/requester
- user handling material pickup when relevant

Minimum notification events:

- MR submitted
- MR approved
- MR rejected
- material taken
- material returned
- MR finalized

Notifications must identify project, MR number, status/event, and actor without changing the current notification behavior of MR Operasional.

## 11. Validation and Error Handling

Server must reject:

- MR without valid `project_id`.
- Duplicate/invalid MR number generation.
- Submit with no items or non-positive requested quantities.
- Extra Inventory material without reason.
- Technician edits outside `draft`/`rejected`.
- Approval/rejection by roles other than Manager/Admin.
- Approver attempts to mutate items/qty as part of approval.
- Take quantity above approved/requested remaining quantity.
- Return/use quantity above current outstanding quantity.
- Any movement that would make Inventory or MR quantities invalid.
- Finalization while any item has outstanding quantity greater than zero.

Stock-affecting operations must use a database transaction or equivalent atomic primitive so MR movement and Inventory quantity cannot diverge.

## 12. Regression Boundary

Phase 3B must not change the behavior of:

- existing MR Operasional / `material_request_forms`
- existing WO→MR flow
- existing SO→WO flow
- existing ticket completion flow
- existing Inventory issue behavior used by MR Operasional
- existing Project Tracker Phase 3A/3A2 multi-WO and Gantt behavior

Any shared helper refactor is allowed only when regression tests prove identical legacy behavior.

## 13. Required Test Gate

Implementation is not considered ready until all relevant existing tests remain green and new coverage includes:

1. MR Project number sequence per project, including duplicate/concurrency protection.
2. Technician create/edit/submit permissions.
3. Mandatory reason for material outside BOQ.
4. Manager/Admin approve/reject permissions and read-only approval payload.
5. Reject → technician edit → resubmit cycle.
6. Approval does not change Inventory.
7. Full and partial material take reduces Inventory correctly.
8. Return increases Inventory correctly.
9. Used quantity does not alter Inventory a second time.
10. Outstanding calculation after take/use/return combinations.
11. Final blocked when outstanding > 0 and allowed when outstanding = 0.
12. Notifications and audit/history creation.
13. Regression tests proving MR Operasional, WO→MR, SO→WO, ticket completion, and Project Tracker 3A2 remain unchanged.

## 14. Completion Criteria

Phase 3B is complete when a technician can create and submit an MR tied to a project; Manager/Admin can approve or reject without editing it; user pengambil material can issue and return material with correct Inventory movement; used/returned quantities reduce outstanding to zero; and the MR can then be finalized with complete audit/history and notifications, while all existing MR Operasional behavior remains intact.
