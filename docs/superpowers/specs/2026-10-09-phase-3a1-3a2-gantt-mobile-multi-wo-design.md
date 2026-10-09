# PXL-VNEXT-3A1 / 3A2 Design — Gantt Template, Mobile Project Tracker, Multi-WO

Date: 2026-10-09
Baseline: PXL-VNEXT-3A (`c44c34e139edbc05aa0a6a6dbcc48952436fc3ba`)
Status: Design approved in chat; written spec pending user review.

## 1. Goals

This revision addresses Phase 3A production UAT findings without rewriting Project Tracker or Work Order flows.

### 3A1 goals
- Improve Gantt PDF readability with colored stage bars.
- Extend the default Gantt stage set with `Amprah PLN` and `Tarik Kabel FO`.
- Allow a saved Gantt stage/duration layout to be reused across multiple projects as a shared template.
- Fix Project Tracker mobile rendering so project rows do not overlap or become unreadable.

### 3A2 goals
- Extend the Phase 3A relation from one Primary WO to one Primary WO plus multiple Related WO.
- Related WO may only link existing Work Orders; Project Detail must not create a second WO creation flow.
- One WO may belong to only one Project across both Primary and Related relations.
- Preserve existing WO, TTD, photo, MR, SO→WO, and WO→MR behavior.

## 2. Non-goals

- Do not auto-create Project from SO or WO.
- Do not create WO from Project Detail.
- Do not modify SO→WO or WO→MR logic.
- Do not add Actual/Realisasi Gantt in 3A1/3A2; that remains Phase 3B.
- Do not change BOQ/Today Achievement behavior.
- Do not implement Project Material & MR aggregation yet; 3A2 only prepares authoritative WO-to-Project links for Phase 3B.
- Do not automatically modify existing saved Gantt plans when the default stage list changes.

## 3. Phase 3A1 — Gantt Plan revisions

### 3.1 Default stages

For projects that do not yet have a saved Gantt Plan, the default template becomes nine sequential stages:

1. Preparation
2. Order Barang
3. Amprah PLN
4. Tanam Tiang
5. Tarik Kabel FO
6. Instalasi Perangkat
7. Konfigurasi
8. Testing / Commissioning
9. Serah Terima

Existing saved plans remain unchanged. Users can continue to rename, add, remove, reorder, and modify durations before saving.

### 3.2 Shared Gantt templates

Add shared, reusable Gantt templates. A template stores only:
- template name
- stage name
- stage order
- default duration in calendar days
- audit metadata (created/updated timestamp and actor when practical with existing auth patterns)

A template must NOT store a project start date or project-specific identifiers.

UI in the Gantt tab:
- `Simpan Gantt Plan` continues to save only the current project's plan.
- Add `Simpan Sebagai Template` for users with `project_gantt_manage`.
- Add `Pakai Template` for selecting a shared template.
- Applying a template populates stage names/order/durations into the editor and keeps/uses the current project's start date separately.
- If the current project already has a saved plan, applying a template requires explicit confirmation before replacing the editable plan and saving it.
- Applying a template does not save immediately; the user still presses `Simpan Gantt Plan`.

Default nine-stage layout should be available as a system/default template, but it should not be duplicated in the database for every project.

### 3.3 Gantt PDF colors

Keep A4 landscape and the current sequential date-axis model. Improve visual output:
- Stage bars use a deterministic repeating color palette so neighboring stages are visually distinct.
- Title/header remains clean and professional.
- Date grid remains readable in print/PDF.
- Text maintains sufficient contrast.
- Multi-page pagination remains supported for long schedules.
- Same stage always gets the same color within one generated PDF.

No change to calendar-day calculation: Saturday and Sunday are included.

## 4. Phase 3A1 — Project Tracker mobile fix

Desktop/tablet desktop layout keeps the existing table behavior.

On mobile widths, Project Tracker switches from the 12-column fixed table to project cards. Each card contains the minimum useful information:
- priority + project name
- project status
- PIC
- Material progress
- Jasa progress
- target
- latest issue (truncated/compact)
- action plan (truncated/compact)
- primary action: `Detail`

The mobile card must not require horizontal scrolling for the main project list and must avoid word-by-word column wrapping.

Existing filters, summaries, search, and project actions remain available. The desktop table is not rewritten.

## 5. Phase 3A2 — Multi-WO Project model

### 5.1 Locked relationship model

A Project has:
- zero or one `Primary WO`
- zero or more `Related WO`

A Work Order can belong to at most one Project, regardless of whether it is Primary or Related.

### 5.2 Primary WO

The existing `project_primary_work_orders` relation remains authoritative for the Primary WO. Existing Phase 3A API behavior is preserved unless an internal validation helper is refactored to enforce the global one-WO-one-Project rule.

### 5.3 Related WO persistence

Add an additive relation table, conceptually `project_related_work_orders`, with at least:
- id
- project_id
- work_order_id / ticket_id
- created_at
- created_by where existing backend auth patterns allow it

Constraints:
- unique work_order_id across Related WO links
- unique (project_id, work_order_id)
- validation must reject a WO already linked as Primary to any project
- Primary linking must also reject a WO already linked as Related to any project

The database and backend together should enforce the rule defensively.

### 5.4 Related WO UI

Project Detail → Work Order tab shows:
- Primary WO card/section as today
- Related WO list below it
- `Tambah Related WO` action for users with `project_primary_wo_manage` (reuse existing permission for Phase 3A2; no new permission required)
- search existing WO using the existing compact WO search endpoint/pattern
- WO identifying fields: WO number, customer/project, status, technician when available
- action to open the existing WO using the existing Daftar Tiket/detail flow
- action to unlink a Related WO with explicit confirmation

There is no `Buat WO` action in Project Detail.

### 5.5 One WO = one Project validation

Before linking Primary or Related WO, backend checks both relation sets.

Examples:
- WO linked as Primary in Project A → cannot be Primary or Related in Project B.
- WO linked as Related in Project A → cannot be Primary or Related in Project B.
- A Primary WO cannot also appear as Related in the same project.
- Unlinking removes only the Project relation; it never deletes or edits the WO itself.

## 6. Future Phase 3B compatibility

Phase 3B Material & MR will use all linked WOs for a Project:
- Primary WO
- Related WOs

This enables Project-level MR aggregation without relying on project-name string matching.

No MR aggregation is implemented in 3A2, but the relation model must expose a simple backend method to retrieve all linked WO IDs for a project.

## 7. Permissions

Reuse existing Phase 3A permissions:
- `project_gantt_manage`: edit Gantt plan, save template, apply template.
- `project_primary_wo_manage`: link/unlink Primary and Related WO.

Read-only Project Detail remains under existing Project Tracker read access.

No new role defaults are introduced. Superadmin bypass remains as implemented. Non-Superadmin permissions remain explicit.

## 8. Data migration and backward compatibility

### 3A1 migration
- Additive Gantt template tables only if persistent shared templates require them.
- No rewrite of existing project Gantt plans.
- No automatic application of the new nine-stage default to existing saved plans.

### 3A2 migration
- Additive Related WO table/indexes/constraints.
- Existing Primary WO table remains intact.
- No automatic multi-WO backfill based on project names.
- Existing project and ticket row counts must remain unchanged.

PostgREST schema reload must follow the Full VPS pattern already used in 3A.

## 9. API shape

Exact route names may follow current Phase 3A conventions, but responsibilities are:

### Gantt templates
- list shared templates
- create template from stage layout
- optionally update/delete template if kept in scope; YAGNI recommendation for 3A1 is create/list/apply only unless management becomes necessary during implementation

### Related WO
- list related WOs for project
- search existing candidate WO using existing compact search path
- link related WO
- unlink related WO

All mutation endpoints enforce backend permissions.

## 10. Testing requirements

TDD regression coverage must include:
- default Gantt now contains exactly the approved nine stages in order
- saved existing Gantt plans are not silently modified
- shared template stores stage/order/duration but not project start date
- applying template does not auto-save project plan
- PDF generation uses multiple stage colors and remains landscape/paginated
- mobile Project Tracker renders project cards and desktop table remains available
- Primary WO cannot be linked if already Related elsewhere
- Related WO cannot be linked if already Primary or Related elsewhere
- one WO cannot belong to two projects
- unlink Related WO does not mutate/delete WO
- existing SO→WO and WO→MR routes remain present
- existing Phase 3A tests remain green or are intentionally updated for the approved nine-stage default

## 11. Release sequencing

Recommended release order:

1. `PXL-VNEXT-3A1` — Gantt colors/default stages/templates + mobile Project Tracker fix.
2. Production UAT for 3A1.
3. `PXL-VNEXT-3A2` — Related WO + global one-WO-one-Project enforcement.
4. Production UAT for 3A2.
5. Continue Phase 3B Material & MR using authoritative Primary + Related WO links.

Each release follows:
Audit → TDD implementation → full regression → backup → GitHub push → VPS deploy → migration if needed → schema reload/restart → production verification.

## 12. UAT acceptance

### 3A1
- New unsaved project Gantt shows nine default stages including Amprah PLN and Tarik Kabel FO.
- User can save a project Gantt, save its layout as a template, open another project, apply the template, set a separate start date, and save.
- PDF shows colored bars and remains readable on landscape A4.
- Project Tracker on mobile displays readable project cards without overlapping columns.

### 3A2
- Project can retain one Primary WO and link multiple existing Related WOs.
- Same WO cannot be linked to another project.
- Related WO opens through existing WO flow.
- Unlinking a Related WO leaves the WO and all its history untouched.
