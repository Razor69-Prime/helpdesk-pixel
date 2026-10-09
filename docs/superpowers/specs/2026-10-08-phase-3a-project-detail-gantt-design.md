# PixelApps VNext Phase 3A — Project Detail Core + Gantt Plan

## Status
Design approved in chat for Phase 3A scope. Implementation has not started.

## Objective
Extend the existing Project Tracker without rewriting it. Phase 3A adds a Project Detail center, one Primary Work Order link per project, and a manual sequential Gantt Plan with automatic calendar-date calculation and PDF export.

## Non-goals for Phase 3A
- Do not change existing SO → WO flow.
- Do not change existing WO → MR flow.
- Do not create a new Material Request engine.
- Do not implement Plan vs Actual/Realisasi yet; that belongs to Phase 3B.
- Do not implement Project Documents/achievement attachments yet; that belongs to Phase 3C.
- Do not implement SPJ generation yet; that belongs to Phase 3D after the user supplies the SPJ template.
- Do not auto-create Project from Sales Order or Work Order.

## Existing System to Preserve
Project Tracker already supports manual project creation, Project Report, Detail BOQ Material/Jasa, Today Achievement, Total Done, Remain, category progress, history, permissions, and Excel import. Existing tables and endpoints remain the source of truth for BOQ and achievement.

Existing project list, project report, BOQ, and achievement behavior must continue to work unchanged after Phase 3A deployment.

## Core Business Rules
1. Project is created manually from Project Tracker, as today.
2. One Project has at most one Primary Work Order in Phase 3A.
3. The Primary WO is a link/reference to an existing WO; the WO is not copied or moved.
4. Linking/unlinking a Primary WO never deletes or changes the WO workflow.
5. Gantt Plan is manual planning data owned by the Project.
6. Gantt tasks run sequentially, one after another.
7. Duration uses calendar days, including Saturday and Sunday.
8. User enters Project Start Date and duration for each stage. Start/end dates for all stages are calculated automatically.
9. Editing duration/order/name recalculates all following planned dates.
10. Phase 3A stores Plan only. Future Actual/Realisasi must never overwrite Plan.

## Project Detail Structure
Add a Project Detail view reachable from the existing Project Tracker list.

Phase 3A tabs:
- Overview
- BOQ & Report
- Gantt Chart
- Work Order

Future tabs reserved for later phases:
- Material & MR
- Documents
- SPJ

The future tabs should not be exposed as active unfinished features in Phase 3A.

## Overview
Overview reuses existing project data and shows a compact summary:
- Project name
- PIC
- Priority
- Status
- Target
- Estimated cost/HPP
- Estimated revenue/omzet
- Latest issue
- Action plan
- Existing Material progress
- Existing Jasa progress
- Existing Overall progress
- Primary WO number/status when linked
- Planned Gantt period when a Plan exists

No duplicate project master is created.

## BOQ & Report
This tab reuses the existing Project Report/Detail BOQ source of truth.

Requirements:
- Preserve existing Material/Jasa BOQ rows.
- Preserve Today Achievement input.
- Preserve Total Done, Remain, Progress, and history.
- Do not duplicate or migrate BOQ data into a second structure.
- Existing permissions such as `project_boq_manage` continue to work.

## Primary Work Order
### Recommended data model
Use a project-level link rather than matching by `project_name` text.

For Phase 3A, store one optional `primary_work_order_id` / equivalent normalized link for each project. Implementation may use a dedicated relation table if that is safer with the existing schema, but the application contract remains one active Primary WO per Project.

### Link flow
Project Detail → Work Order → Link Primary WO → search existing WO → select → save.

Search should support at least:
- WO number
- Customer
- Project/customer text already present on WO

### Display
Show:
- WO number
- WO type
- Status
- Customer
- Assigned technician(s)
- Created/scheduled date where available
- Button to open the existing WO detail/flow

### Safety
- Linking a WO must not change WO status.
- Unlinking must not delete a WO.
- Existing WO TTD, photo, remarks, Survey, MR, and status behavior remain untouched.
- A WO already linked as Primary WO to another project must be blocked from being linked again unless it is first unlinked.

## Gantt Plan
### Default template
Initial default stage template is editable per project:
1. Preparation
2. Order Barang
3. Tanam Tiang
4. Instalasi Perangkat
5. Konfigurasi
6. Testing / Commissioning
7. Serah Terima

The user may later provide the final standard stage list. Changing the default template later must not rewrite existing project plans.

### Inputs
At project-plan level:
- Project Start Date

Per stage:
- Stage name
- Duration in calendar days (positive integer)
- Optional note
- Sort/order position

Users can:
- add stage
- rename stage
- delete stage
- reorder stage
- edit duration

A project plan may contain at most 100 stages in Phase 3A.

### Date calculation
For each stage:
- Stage 1 start = Project Start Date.
- Stage end = start + duration - 1 calendar day.
- Next stage start = previous stage end + 1 calendar day.
- Saturdays and Sundays are counted.

Example:
Project Start Date: 1 Oct
- Preparation, 3 days → 1–3 Oct
- Order Barang, 7 days → 4–10 Oct
- Tanam Tiang, 5 days → 11–15 Oct

If Preparation changes from 3 to 5 days, every following planned start/end date recalculates automatically.

### Plan baseline behavior
Phase 3A should keep planned dates as the current approved Plan dataset. Actual/Realisasi will be a separate dataset in Phase 3B and must not overwrite planned dates.

If the user edits the Plan itself in Phase 3A, the system updates the current Plan. Plan revision-history/versioning is explicitly deferred and must not be added in Phase 3A.

## Gantt UI
The layout should follow the user's supplied Gantt reference:
- Task/stage names on the left.
- Calendar timeline across the top.
- Horizontal bars for each planned stage.
- Sequential visual flow from top to bottom.
- Responsive Project Detail UI; the chart may use a contained horizontal scroll on small screens rather than forcing the entire page to scroll sideways.

The chart is a planning view, not a replacement for BOQ progress.

## Gantt PDF Export
Provide `Download PDF` from the Gantt tab.

PDF requirements:
- Landscape orientation.
- Project name and plan period.
- Stage names.
- Calendar/date scale.
- Planned bars aligned to dates.
- Duration per stage.
- Generated date.
- Clean printable layout suitable for project meetings/reports.

The exported PDF in Phase 3A contains Plan only. Plan-vs-Actual PDF belongs to Phase 3B.

## Permissions
Preserve existing Project Tracker and BOQ permissions.

Phase 3A introduces granular control for new actions rather than exposing management to every Project Tracker reader. Recommended permission boundaries:
- Project Detail read: reuse existing Project Tracker read access.
- Manage Gantt Plan: new granular permission, Superadmin bypass.
- Link/unlink Primary WO: new granular permission, Superadmin bypass.

New management permissions default OFF for non-Superadmin accounts and can be granted from Manajemen Akun. Backend enforcement is mandatory; hiding a button in frontend is not sufficient.

Use explicit permission IDs: `project_gantt_manage` for Gantt Plan management and `project_primary_wo_manage` for Primary WO link/unlink. Both default OFF for non-Superadmin accounts.

## API/Data Boundaries
Recommended isolated units:
1. Project Detail aggregation endpoint/service: combines existing project + report summary + Primary WO + Gantt plan metadata.
2. Primary WO link endpoint/service: only manages the relation.
3. Gantt Plan endpoint/service: CRUD for plan header/stages and server-side date validation/calculation.
4. Gantt PDF generation will be client-side using the existing jsPDF pattern. Calculations must use stored Plan data and the output must be deterministic.

Do not make Project Detail dependent on opening Project Report first.

## Validation and Error Handling
- Reject missing/invalid Project Start Date.
- Reject zero, negative, decimal, NaN, or durations above 3650 calendar days; duration must be a positive whole number from 1 to 3650.
- Prevent duplicate stage sort positions in stored output by normalizing order.
- Reject linking nonexistent WO.
- Reject linking a WO already attached as Primary WO to another project.
- Handle deleted/missing linked WO gracefully by showing the relation as unavailable and allowing an authorized user to relink.
- Existing project/BOQ/report errors must not be swallowed by the new UI.

## Migration Strategy
Phase 3A should be additive.

Expected new persistence:
- Primary WO relation for projects.
- Gantt Plan header/start date.
- Gantt Plan stages with name, duration, calculated planned start/end, order, notes, audit timestamps/user.

Do not backfill guessed Primary WO links by matching project names automatically. Existing projects start with no Primary WO unless explicitly linked.

Existing projects may initialize a Gantt Plan from the default template only when an authorized user explicitly creates the Plan; do not bulk-create plans during migration.

## Audit/History
At minimum log these actions through the existing activity log pattern:
- Link Primary WO
- Unlink Primary WO
- Create Gantt Plan
- Update Gantt Plan

New Primary WO relation and Gantt records must store `created_by`, `created_at`, `updated_by`, and `updated_at`.

## Testing Strategy
Use TDD for implementation.

Minimum regression coverage:
- Existing Project Tracker list still loads.
- Existing Project Report/BOQ endpoints still behave the same.
- Existing achievement input still works.
- One Project can link one WO.
- One WO cannot be Primary WO for two projects at the same time.
- Unlink does not delete/change WO.
- Sequential calendar-day date calculation is correct across weekends and month boundaries.
- Duration edit shifts all subsequent stages.
- Reorder recalculates dates correctly.
- Invalid duration is rejected.
- Gantt management permission enforced by backend.
- WO-link permission enforced by backend.
- PDF action is available only when a Plan exists and produces the expected Plan metadata.

Run existing production-relevant regression suites plus new Phase 3A tests before deployment.

## Deployment/UAT Gate
Follow the canonical workflow:
Audit → Implementation → Testing/syntax → Push GitHub → Deploy VPS → Migration (if needed) → Production UAT.

Before calling Phase 3A complete, production UAT must verify:
1. Existing Project Tracker remains intact.
2. Open Project Detail.
3. Link one existing Primary WO and open it successfully.
4. Create Gantt from Project Start Date + default stages.
5. Edit duration and confirm all later dates shift automatically using calendar days.
6. Add/remove/reorder a stage.
7. Download Gantt Plan PDF and verify layout/date alignment.
8. Confirm BOQ and Today Achievement still work as before.

## Deferred Phase 3B Contract
Phase 3B will add separate Actual/Realisasi data, Plan vs Actual reporting, and Material & MR integration. It must treat Phase 3A Plan as immutable reference data from the Actual reporting perspective; Realisasi must never overwrite Plan.

## Deferred Achievement Attachment Contract
Attachments/photos requested by the user will be attached to a specific Today Achievement record/date in Phase 3C, not merely to the generic BOQ item. This is intentionally outside Phase 3A.
