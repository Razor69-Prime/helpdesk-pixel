# PXL-VNEXT-IPO1 — Project Internal PO Monitoring Design

Date: 2026-10-14
Baseline: `PXL-VNEXT-3D5` (`2aedba7`)
Status: Design approved in conversation; written spec pending user review

## 1. Purpose

Add an **Internal PO** tab inside Project Detail as an internal purchasing-monitoring worksheet for each Project. This is **not a formal Purchase Order**, does not create a supplier PO, and does not post inventory or accounting transactions.

The feature should let Pixel Solusindo track, per Project, what material is planned for purchase, what has arrived, the actual manual purchase price, the supplier used for each line, purchasing status, and issues. The user-provided spreadsheet layout is the visual/structural reference: a simple row-based monitoring table with totals.

Also expose the existing human-readable **Project ID / Project Number** (for example `PRJ-26-013`) directly in the Project Tracker list/card so users can identify a Project without opening Project Detail.

## 2. Success Criteria

The feature is successful when:

1. Every Project has one Internal PO monitoring workspace, not multiple supplier-specific POs.
2. One Internal PO may contain many items and each item may have a different supplier.
3. Items can be seeded from an existing Purchase Request or added through fast search/autocomplete from the current Project's BOQ Material.
4. Importing a PR autofills all PR item rows, including item name, quantity, unit, price when present, and supplier when present; all imported monitoring values remain editable without changing the PR.
5. Users can manually update Qty Arrived, purchasing state, supplier, actual purchase price, and issue notes.
6. Line totals and the grand total are calculated from Qty PO and manually entered actual unit price only. No tax/PPN or discount rules are applied.
7. Overall Internal PO status is derived automatically from item states.
8. Important edits are auditable through history.
9. Internal PO can be exported to Excel and PDF.
10. Users without manage permission but with Project Tracker access can view the Internal PO read-only.
11. No Internal PO action changes Inventory, Project MR, Project BOQ, Project Report/Input Today, Purchase Request, supplier master, invoice, or other accounting data.

## 3. Terminology and Non-Goals

### Internal PO means monitoring only

"Internal PO" is a Project-level internal worksheet. It is intentionally **not**:

- a legal/formal PO document;
- a PO number series;
- one PO per supplier;
- a replacement for Purchase Request;
- a stock receipt process;
- an Inventory restock transaction;
- an accounting payable/cost-posting workflow;
- an approval workflow.

There is exactly one monitoring workspace per Project. Supplier is stored per item line.

### Out of scope

This revision does not:

- decrement or increment Inventory;
- sync Qty Arrived into Inventory;
- alter MR allowances or Project material usage;
- alter BOQ quantity or Project progress;
- write back to a source Purchase Request after import;
- calculate PPN, discounts, withholding tax, or tax-inclusive/exclusive values;
- create supplier purchase documents;
- add ETA tracking;
- introduce a new Phase 5 workflow.

## 4. User Experience

### 4.1 Project Detail tab

Add a new tab to the existing Project Detail sequence:

`Overview | BOQ & Report | Gantt Chart | Work Order | Material Request | Internal PO`

The Internal PO tab shows:

- Project ID / Project Number;
- Project Name;
- derived overall Internal PO status;
- total monitored item rows;
- counts for Arrived, Partial/Pending, and items with Issue;
- Total Harga Beli;
- a general Project-level Internal PO Issue field;
- action buttons:
  - `Pilih Purchase Request`;
  - `Tambah Item BOQ`;
  - `Simpan Perubahan`;
  - `Export Excel`;
  - `Export PDF`;
  - `Riwayat Perubahan`.

`Simpan Perubahan`, PR import, BOQ add, row edit, and row removal are enabled only for users with manage permission. Export remains available to read-only viewers.

### 4.2 Main monitoring table

Use the user's spreadsheet as the structural reference. The main columns are:

| No | Nama Barang | Qty PO | Qty Arrived | Satuan | Harga Beli Aktual | Total | Supplier | Status | Issue |
|---|---|---:|---:|---|---:|---:|---|---|---|

Behavior:

- `Nama Barang`: seeded from PR or BOQ; may be edited in the Internal PO without changing the source.
- `Qty PO`: editable numeric quantity greater than zero.
- `Qty Arrived`: editable numeric quantity from zero to Qty PO.
- `Satuan`: seeded from PR/BOQ and editable as a monitoring snapshot.
- `Harga Beli Aktual`: optional manual unit price. This is the user's final entered value; PixelApps does not infer whether it includes PPN or other adjustments.
- `Total`: read-only calculated line total.
- `Supplier`: seeded from PR if present and editable as free-text monitoring data. It may also retain a source supplier ID for provenance, but the editable supplier name is authoritative for the Internal PO display/export.
- `Status`: derived from Qty Arrived plus a small manual purchasing-state selector as defined below.
- `Issue`: optional free-text issue for that line.

Rows with an issue receive a clear visual indicator. Arrived is green, Partial Arrived is amber/orange, Hold is orange/red, Cancelled is gray/red, and other in-progress states use neutral/blue/yellow styling consistent with PixelApps.

### 4.3 Unsaved changes

Internal PO does **not** autosave. A user with manage permission edits multiple rows and presses `Simpan Perubahan`.

If there are unsaved changes and the user attempts to switch Project Detail tabs, close Project Detail, or navigate away, PixelApps must show a confirmation before discarding the draft.

## 5. Item Sources

### 5.1 Import from Purchase Request

`Pilih Purchase Request` opens a searchable list of existing Purchase Requests with PR Number, date, requester/outlet, and status visible. Because Internal PO is monitoring-only, the source PR approval status is informational and does not alter Internal PO calculations.

When a PR is selected, **all PR items are autofilled** into the Internal PO draft. Current PR item fields map as follows:

- `desc` -> `item_name`;
- `qty` -> `qty_po`;
- `unit` -> `unit`;
- positive `price` -> `actual_unit_price`; zero/missing price -> blank price;
- `supplier_id` -> `source_supplier_id` when available;
- `supplier_name` -> editable `supplier_name`.

Imported rows start with:

- `qty_arrived = 0`;
- manual purchasing state = `not_ordered`;
- blank item issue.

The PR is a **snapshot source only**. Editing or saving Internal PO never PATCHes the source PR.

Purchase Request item arrays currently have no stable item UUID, so provenance uses `source_pr_id` plus `source_pr_item_index`. Re-importing the same PR must not overwrite edits already made to rows previously imported from that PR. Already-imported source indexes are skipped; new source indexes may be appended.

### 5.2 Add from Project BOQ Material

`Tambah Item BOQ` provides fast search/autocomplete using the same interaction pattern as Project MR, but the search domain is strictly the current Project's **BOQ Material** rows.

Important constraints:

- do not search Inventory;
- do not search Master Pricelist;
- do not add an Inventory fallback;
- do not perform item-name matching against Inventory;
- Jasa is not selectable;
- selection retains the BOQ item identifier for provenance.

The selected BOQ item's name, unit, and BOQ reference are copied as a monitoring snapshot. The Internal PO remains independent after selection. The same BOQ material may be added more than once when purchasing is split across suppliers or batches.

There is no generic arbitrary-item search outside BOQ. Items that are not in BOQ can still enter Internal PO through an imported PR, because PR import explicitly copies all PR item rows.

## 6. Status Rules

### 6.1 Per-item manual state

The user can manually choose a base purchasing state from:

- `Belum Dipesan` (`not_ordered`)
- `Ordered` (`ordered`)
- `Hold` (`hold`)
- `Cancelled` (`cancelled`)

`Partial Arrived` and `Arrived` are derived from quantities and are not manually forced.

### 6.2 Per-item displayed status

Status precedence:

1. if manual state is `cancelled` -> `Cancelled`;
2. else if `qty_arrived >= qty_po` and `qty_po > 0` -> `Arrived`;
3. else if `qty_arrived > 0` and `qty_arrived < qty_po` -> `Partial Arrived`;
4. else if manual state is `hold` -> `Hold`;
5. else if manual state is `ordered` -> `Ordered`;
6. otherwise -> `Belum Dipesan`.

The server must recompute status; client-side status is preview only.

### 6.3 Overall Internal PO status

Overall status is computed from active item rows and is not manually editable:

- no rows -> `Belum Ada Item`;
- all rows Cancelled -> `Cancelled`;
- all non-cancelled rows Arrived -> `Completed`;
- any active row Partial Arrived, or a mixture of Arrived and unfinished active rows -> `Partial`;
- no arrivals yet but at least one active row is Ordered or Hold -> `In Progress`;
- otherwise -> `Belum Dipesan`.

Cancelled rows do not block `Completed` for the remaining active rows.

## 7. Price and Quantity Calculations

### 7.1 Validation

- `qty_po` must be greater than zero.
- `qty_arrived` must be zero or greater.
- `qty_arrived` must not exceed `qty_po`.
- `actual_unit_price` may be blank/null or zero/positive.
- negative prices are invalid.
- item name is required.
- supplier and issue are optional.

The server is authoritative for all validation.

### 7.2 Totals

When an actual unit price exists:

`Line Total = Qty PO × Harga Beli Aktual`

The line total is based on Qty PO, **not** Qty Arrived.

If the price is blank, the line total is displayed as `—` / not available rather than pretending the price is zero.

`Total Harga Beli = sum(Line Total for rows with a known actual unit price)`

No tax, discount, PPN, or other financial formula is applied.

## 8. Issues and History

Two issue levels are supported:

1. **General Internal PO Issue** at Project monitoring level.
2. **Per-item Issue** on each monitoring row.

Every successful save records meaningful changes in `project_internal_po_history`, including:

- row added;
- row edited;
- row removed;
- Qty PO change;
- Qty Arrived change;
- item name/unit change;
- supplier change;
- price change;
- manual purchasing-state change;
- per-item issue change;
- general issue change.

Each history event records actor, timestamp, change type, target row when applicable, and before/after values or a compact JSON diff.

The tab exposes a read-only `Riwayat Perubahan` view sorted newest first.

## 9. Data Model

Use dedicated tables so Internal PO is isolated from PR, BOQ, MR, Inventory, and finance.

### 9.1 `project_internal_po`

One row per Project.

Proposed fields:

- `id uuid primary key default gen_random_uuid()`
- `project_id uuid not null references projects(id)`
- `general_issue text`
- `created_by_id text`
- `created_by_name text`
- `created_at timestamptz default now()`
- `updated_by_id text`
- `updated_by_name text`
- `updated_at timestamptz default now()`
- unique index on `project_id`

Overall status and grand total are computed from active item rows rather than stored as mutable business-state columns.

### 9.2 `project_internal_po_items`

Proposed fields:

- `id uuid primary key default gen_random_uuid()`
- `internal_po_id uuid not null references project_internal_po(id)`
- `project_id uuid not null references projects(id)`
- `source_type text not null` constrained to `pr` or `boq`
- `source_pr_id uuid null`
- `source_pr_number text null`
- `source_pr_item_index integer null`
- `source_boq_item_id uuid null`
- `item_name text not null`
- `qty_po numeric not null`
- `qty_arrived numeric not null default 0`
- `unit text`
- `actual_unit_price numeric null`
- `source_supplier_id uuid null`
- `supplier_name text null`
- `manual_state text not null default 'not_ordered'`
- `issue text null`
- `sort_order integer not null default 0`
- `created_by_id text`
- `created_by_name text`
- `created_at timestamptz default now()`
- `updated_by_id text`
- `updated_by_name text`
- `updated_at timestamptz default now()`
- `deleted_at timestamptz null`
- `deleted_by_id text null`
- `deleted_by_name text null`

Use soft delete for monitoring rows so audit history is not broken. Active reads filter `deleted_at is null`.

A partial unique index should prevent duplicate active import of the same `(internal_po_id, source_pr_id, source_pr_item_index)` when `source_type='pr'`, while BOQ rows intentionally allow repeated source BOQ items.

### 9.3 `project_internal_po_history`

Proposed fields:

- `id uuid primary key default gen_random_uuid()`
- `project_id uuid not null references projects(id)`
- `internal_po_id uuid not null references project_internal_po(id)`
- `item_id uuid null`
- `change_type text not null`
- `field_name text null`
- `before_value jsonb null`
- `after_value jsonb null`
- `actor_id text`
- `actor_name text`
- `created_at timestamptz default now()`

Indexes should support Project-based reads and newest-first history.

## 10. Atomic Save Contract

Because the UI intentionally saves the full draft with one `Simpan Perubahan` action, the database write must be atomic.

Implement an RPC or equivalent transaction, for example:

`pxl_vnext_internal_po_save(p_project_id uuid, p_general_issue text, p_items jsonb, p_actor_id text, p_actor_name text)`

The transaction must:

1. verify the Project exists;
2. validate all rows;
3. create/upsert the one Project Internal PO header;
4. insert/update/soft-delete rows based on submitted row IDs and source provenance;
5. calculate diffs against the previous saved state;
6. insert history events;
7. return the fresh normalized Internal PO payload.

A validation failure rolls back the entire save. Partial row saves are not allowed.

The server must not trust client-supplied derived status, line total, or grand total.

## 11. API Design

All routes remain session-authenticated.

### Read

- `GET /api/projects/:projectId/internal-po`
  - requires normal Project Tracker read access;
  - returns project summary, header, active rows, computed statuses/totals, and `can_manage`.

- `GET /api/projects/:projectId/internal-po/history`
  - requires Project Tracker read access;
  - returns newest-first history.

### Manage support

- `GET /api/projects/:projectId/internal-po/purchase-requests?q=...`
  - requires `project_internal_po_manage` effective permission;
  - returns searchable PR summaries and item snapshots sufficient for import;
  - exists separately from the current global `/api/purchase-requests` role restriction so a specifically authorized Internal PO manager can use the feature without expanding unrelated PR page permissions.

- `GET /api/projects/:projectId/internal-po/boq-options?q=...`
  - requires effective manage permission;
  - returns only current Project BOQ rows where category is Material;
  - uses stable BOQ item IDs;
  - does not search Inventory/Pricelist.

- `PUT /api/projects/:projectId/internal-po`
  - requires effective manage permission;
  - submits general issue plus the full active draft and calls the atomic save path.

No Internal PO endpoint writes to Purchase Request, Inventory, MR, BOQ, Project Report achievement, Invoice, or Supplier tables.

## 12. Permission Model

Add a dedicated account-management permission checkbox:

`project_internal_po_manage` — **Kelola Internal PO Project**

Effective manage access:

- Superadmin: always allowed.
- Manager: default allowed.
- Admin: default allowed.
- Accounting/Purchasing account: default allowed through the existing Accounting role used by Purchasing/PR operations.
- Any other account: allowed only when `project_internal_po_manage` is checked in Manajemen Akun.

Read access:

- any user who already has permission to open Project Tracker/Project Detail may view Internal PO read-only;
- this new permission must not grant Project Tracker access by itself.

The browser controls are convenience only. Server routes enforce the same rule.

## 13. Project Tracker Project ID

The Project Tracker list/card must display the stable human-readable `projects.project_number`, for example `PRJ-26-013`.

Requirements:

- show `project_number`, not raw UUID, when available;
- retain current project name, progress badges, and Detail action;
- do not change sorting/filtering behavior unless needed to make Project ID searchable;
- include Project ID in existing text search so users can find `PRJ-26-013` directly.

No project-number regeneration is introduced. Existing Phase 3B project numbering remains authoritative.

## 14. Excel Export

Use the existing SheetJS/XLSX library already loaded by PixelApps.

The export is a Project Internal PO monitoring report, not a supplier purchase document.

Include:

- Pixel Solusindo title;
- Project ID;
- Project Name;
- Overall Status;
- export timestamp;
- General Issue;
- columns matching the visible monitoring table;
- Total Harga Beli at the bottom.

Price cells must be numeric currency-friendly values in the workbook where possible, not preformatted text-only numbers.

Filename example:

`Internal-PO-PRJ-26-013-20261014.xlsx`

## 15. PDF Export

Use existing jsPDF + AutoTable libraries. Prefer landscape A4 because the monitoring table has many columns.

Header:

- `PIXEL SOLUSINDO`
- `INTERNAL PO — PROJECT MONITORING`
- Project ID
- Project Name
- Overall Status
- Generated date/time
- General Issue when present

Table columns mirror the visible monitoring table. The bottom includes `TOTAL HARGA BELI`.

The PDF must not include formal PO language such as "PO To Supplier", payment terms, approval signatures, or supplier-specific document numbering.

Filename example:

`Internal-PO-PRJ-26-013-20261014.pdf`

## 16. Error Handling

- PR/BOQ search failure shows an inline error without closing Project Detail.
- Save validation errors identify the affected row when possible.
- Save network/database failure leaves the draft intact so the user can retry.
- Export is disabled only when the relevant client library is unavailable; show a clear reload/retry message.
- Read-only users never see active editable controls.
- If a source PR or BOQ row is later changed/deleted, saved Internal PO snapshots remain readable and editable because source references are provenance, not live dependencies.

## 17. Testing Requirements

Add automated regression coverage for at least:

1. migration is additive/idempotent and contains no DROP/TRUNCATE;
2. one Internal PO header per Project;
3. PR import field mapping for all current PR item fields;
4. re-import does not overwrite an already-imported PR row;
5. BOQ search only returns Material from the current Project;
6. Inventory/Pricelist is not used by Internal PO search;
7. Qty validation, including rejection when Qty Arrived exceeds Qty PO;
8. per-item status derivation;
9. overall status derivation;
10. line total and grand total calculations;
11. blank price remains unknown rather than becoming an implied purchased cost;
12. general issue and per-item issue persistence;
13. history creation for add/edit/remove and meaningful field changes;
14. atomic rollback on invalid multi-row save;
15. manage-permission enforcement server-side;
16. read-only Project Tracker user can view but cannot mutate;
17. account-management checklist persists `project_internal_po_manage`;
18. Excel export contains Project ID, table rows, and grand total;
19. PDF export contains Project ID, table rows, and grand total;
20. Project Tracker displays and searches by `project_number`;
21. Internal PO save/import does not mutate PR, Inventory, Project MR, BOQ, Project Report, or finance data;
22. existing full regression suite remains passing.

## 18. Implementation Boundaries

Prefer an isolated client module such as `public/pxl-vnext-internal-po.js` integrated into the existing Project Detail shell rather than growing the Project Detail file with all Internal PO behavior.

Backend logic should similarly keep status/validation/calculation helpers isolated and testable. Database methods belong in the existing DB adapter pattern, while transactional write logic should remain in the database RPC so a multi-row Save is all-or-nothing.

Do not refactor unrelated Project Detail, Purchase Request, Inventory, MR, or reporting code as part of this revision.

## 19. Deployment / UAT Expectations

Implementation must be developed from the latest `main` baseline, not the obsolete local Phase 3D implementation branch.

Before production deployment:

- run static syntax checks on changed JavaScript;
- run targeted Internal PO tests;
- run the full regression suite;
- inspect git diff for unrelated changes;
- create a PostgreSQL 17 backup before applying the additive migration;
- apply migration once and verify tables/RPC through the live database/PostgREST;
- deploy without deleting the existing untracked `backups/` or `public/downloads/` directories;
- restart the Node supervisor process;
- verify HTTP assets/API and execute production UAT.

Production UAT should cover PR import, BOQ fast search, editable imported supplier/name/qty/price, Qty Arrived status, general/item issues, history, permission/read-only behavior, Excel/PDF, Project ID display/search, and proof that source PR/Inventory/MR/BOQ remain unchanged.
