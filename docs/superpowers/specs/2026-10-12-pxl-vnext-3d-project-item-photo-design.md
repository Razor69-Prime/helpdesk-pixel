# PXL-VNEXT-3D — Project Item Photo Documentation Design

**Status:** Design approved in conversation; implementation not started  
**Baseline:** `main` at `04d2c7607236faf0c4c685eca444d15eda62ba45` (`PXL-VNEXT-3C`)  
**Scope:** Project Tracker / Project Report only  
**Production rule:** Phase 3C remains the live trial baseline and its material-ledger behavior must not change.

## 1. Goal

Add internal photo documentation per Project BOQ item (Material and Jasa) and require valid photo evidence for every `Input Today > 0`, without changing the existing Project Report progress formulas, Project MR ledger, PDF report, WhatsApp report, WO Ops photo flow, or customer tracking.

Success means:

- every saved Project achievement has at least one valid photo from the same BOQ item;
- photos can also exist as standalone item-gallery documentation without changing progress;
- camera and gallery uploads are processed into a Pixel-branded, GPS-stamped watermarked image before Cloudinary upload;
- old photos from the same item can be reused as evidence for later achievements without duplicating the Cloudinary file;
- photo download, deletion audit, and monthly backup work without mixing Project photos with WO Ops photos.

## 2. Locked Product Rules

### 2.1 Project/WO boundaries

- One Project Tracker continues to use its existing Primary WO Project identity.
- Related WO remains reference-only and must not participate in Project BOQ, Project MR, achievement, or photo accounting.
- Project Material/Jasa remains separate from Operational WO Item/Jasa.
- Project photos are a new Project-specific data set and must not be written into `work_order_photos` or Service photo tables.

### 2.2 Hybrid photo model

Photos support two uses:

1. **Achievement evidence** — attached to an `Input Today` achievement.
2. **Standalone gallery documentation** — attached to a BOQ item without changing achievement/progress.

A standalone gallery photo may later be selected as evidence for an achievement on the same BOQ item.

### 2.3 Mandatory evidence rule

- Every BOQ item with `Input Today > 0` requires at least one active photo from that exact item.
- The rule applies to both Material and Jasa.
- A photo from another item is invalid even when both items belong to the same Project.
- Existing photos from the same item may be selected.
- One photo may be linked to multiple achievements on the same item.
- The same Cloudinary file must not be duplicated when reused.

### 2.4 Per-item save isolation

Project Report may save several changed items in one user action, but each item remains independently committed.

Example: if item 1 and item 3 succeed while item 2 fails photo validation/upload, item 1 and item 3 remain saved and item 2 remains unsaved with a retry state. There is no batch-wide rollback across different BOQ items.

## 3. Permissions

### Upload / select evidence

The following roles may upload Project item photos and use them as evidence when they already have access to the relevant Project flow:

- Technician
- Manager
- Admin
- Superadmin

### View / download

Any internal user who is authorized to access the Project may view and download its Project item photos.

### Delete

Only:

- Admin
- Superadmin

may delete Project photos.

Technicians and Managers cannot delete photos after upload.

There is no customer/public visibility flag in Phase 3D. Project photos are internal only.

## 4. Storage Architecture

Use the existing Cloudinary signed-upload pattern already used by PixelApps, but keep Project photo metadata in Project-specific tables.

The browser/mobile device performs image processing before upload so the VPS does not resize or render watermarks.

Only the final watermarked image is uploaded and retained. The original unwatermarked image must not be persisted by PixelApps or Cloudinary.

### 4.1 `project_report_item_photos`

One row represents one final watermarked image.

Required data model:

- `id` UUID primary key
- `project_id` UUID, FK to Project
- `project_report_item_id` UUID, FK to `project_report_items`
- `secure_url`
- `cloudinary_public_id` unique
- `original_filename` when available
- `generated_filename`
- `source_type` enum/check: `camera` or `gallery`
- `project_number_snapshot` / Project ID snapshot (for example `PRJ-26-013`)
- `latitude`
- `longitude`
- `address_text`
- `location_label` when reverse-geocoding provides a useful locality/area
- `evidence_time`
- `time_semantics` enum/check: `documentation` or `upload`
- `uploaded_by_user_id`
- `uploaded_by`
- `uploaded_at`
- `created_at`
- `updated_at`
- `deleted_at`
- `deleted_by_user_id`
- `deleted_by`

All normal gallery queries exclude `deleted_at is not null`.

### 4.2 `project_report_achievement_photos`

Many-to-many relation between achievements and Project item photos.

Required data model:

- `id` UUID primary key
- `achievement_id` UUID FK to `project_report_item_achievements`
- `photo_id` UUID FK to `project_report_item_photos`
- `linked_by_user_id`
- `linked_by`
- `created_at`

A unique constraint on `(achievement_id, photo_id)` prevents duplicate links inside one achievement.

A single `photo_id` may appear against multiple achievements as long as server validation confirms every achievement belongs to the same `project_report_item_id` as the photo.

## 5. Achievement Transaction Contract

The existing Project achievement endpoint is extended to accept `photo_ids[]`.

Before saving an achievement, the backend must re-read authoritative state and validate:

1. BOQ item exists and is accessible;
2. `achievement > 0`;
3. at least one `photo_id` is supplied;
4. every selected photo exists and is active (not soft-deleted);
5. every selected photo belongs to the exact same `project_report_item_id`;
6. existing BOQ remain validation passes;
7. for Material, the existing Phase 3C material ledger validation passes unchanged.

Creation of the achievement row and its photo-link rows must be atomic within one database transaction/RPC. If any link creation fails, the achievement must not remain committed.

Phase 3D must not weaken or bypass Phase 3C. Material remains governed by:

`Total Done + requested Input Today <= MR Approved + active Override`

and by the existing BOQ cap. Jasa remains outside Project MR.

## 6. Photo Capture and Processing Flow

### 6.1 Entry point

Every Material/Jasa row in Project Report gets a `📷 Foto` action.

The item photo modal supports:

- camera capture;
- gallery/file selection;
- final watermarked preview;
- upload progress and per-file failures;
- existing item gallery;
- selecting existing active photos as evidence for Input Today;
- per-photo download;
- Download All for the item.

### 6.2 GPS requirement

All Project photos, including standalone gallery documentation, require successful browser/device GPS acquisition.

If GPS is unavailable, denied, or fails:

- the image is not considered valid;
- no final upload is started;
- the item achievement cannot use that new image;
- UI provides a clear retry action such as `Coba GPS Lagi`.

There is no role bypass for this GPS requirement in Phase 3D, including Superadmin.

### 6.3 Reverse geocoding

PixelApps should reuse its existing browser geolocation/reverse-geocoding pattern.

Latitude and longitude are mandatory. Reverse-geocoded address is best-effort only.

If address lookup fails after GPS succeeds, processing continues with:

`Alamat tidak tersedia`

and the coordinate values remain visible in the watermark and metadata.

### 6.4 Camera vs gallery semantics

For a direct camera capture:

- watermark label/semantics represent **Lokasi/Waktu Dokumentasi**;
- current GPS and current processing/capture time are stored as documentation evidence.

For an image selected from the device gallery:

- watermark label/semantics represent **Lokasi/Waktu Upload**;
- current GPS/current time must not be presented as the original capture time of the historical file.

Phase 3D does not claim EXIF capture location or time for gallery files.

### 6.5 Resize and compression

Before upload:

- resize the image in-browser so the longest side is approximately 1920 px;
- preserve aspect ratio;
- use high-quality lossy output appropriate for documentation;
- apply watermark to the resized image;
- upload only the final watermarked output.

No fixed maximum photo count is imposed per item or per achievement. Uploads must therefore be processed sequentially/per-file with visible progress instead of one unbounded large request.

## 7. Watermark Specification

Use the exact Pixel Solusindo logo supplied by the user in the Phase 3D design conversation (orange/gray Pixel mark with `PIXEL SOLUSINDO` wordmark). During implementation, add that supplied asset to the repository under a dedicated Project watermark asset path; do not substitute a different existing PixelApps logo.

Watermark placement:

- upper area of the image;
- semi-transparent overlay/block;
- logo placed proportionally within the overlay;
- text remains readable without covering an excessive portion of the documentation image.

Watermark contains:

- Pixel Solusindo logo;
- Project ID / project number (for example `PRJ-26-013`);
- locality/location label when available;
- full address or `Alamat tidak tersedia`;
- latitude and longitude;
- date and time;
- current PixelApps user/technician name;
- semantics appropriate to source: `Lokasi/Waktu Dokumentasi` for camera, `Lokasi/Waktu Upload` for gallery.

Watermark must **not** contain:

- Project name;
- BOQ item name;
- map thumbnail;
- Google branding/map artwork.

## 8. Gallery Behavior

The photo gallery is scoped to one BOQ item.

It displays active photos grouped/ordered by documentation/upload date and shows enough metadata to understand:

- image source (`camera`/`gallery`);
- GPS/address;
- timestamp semantics;
- uploader;
- whether/how it has been used as achievement evidence.

An old active photo from the same item may be selected for a new achievement. Its stored watermark, GPS, address, and timestamp are never rewritten when reused.

Standalone gallery uploads do not modify:

- BOQ quantity;
- Total Done;
- Today Achievement;
- Project MR;
- Phase 3C material usage ledger;
- Project progress percentage.

## 9. Delete and Audit Rules

Deletion is soft-delete only in active Phase 3D.

When Admin/Superadmin deletes a photo:

- set deletion metadata (`deleted_at`, `deleted_by_user_id`, `deleted_by`);
- remove the photo from active gallery and future evidence selection;
- do not delete historical `project_report_achievement_photos` links;
- do not modify or roll back historical achievements.

If the photo has historical achievement links, UI must warn that the achievement/history will remain and the photo record will be marked deleted.

Phase 3D provides no hard-delete UI or API.

For historically linked photos, the Cloudinary object should not be immediately destroyed as part of the user-facing soft-delete action; retention remains available for audit/backup policy.

## 10. Download Behavior

### Per-photo

Each active gallery image has a `Download` action for the final watermarked image.

### Download All

Each item has `Download Semua Foto`.

The result contains all active photos for that item exactly once, even if a photo is linked to multiple achievements.

Use streaming/on-demand ZIP generation rather than retaining permanent ZIP files on VPS storage. Filename/folder naming should include Project ID and stable item/date information while remaining filesystem-safe.

Soft-deleted photos are excluded from Download All.

## 11. Upload Failure Handling

Uploads are per-file/sequential.

If several selected photos produce mixed results, successful uploads remain valid gallery records and failed files are shown individually for retry.

At least one valid photo is sufficient to satisfy an achievement's evidence requirement when that photo is selected for that achievement.

### Cloudinary success / DB metadata failure

If Cloudinary upload succeeds but metadata persistence fails, the system should attempt cleanup of that newly created Cloudinary object. The image must not be treated as a valid Project photo unless metadata persistence succeeds.

If cleanup itself fails, record the error for operator review rather than silently treating the image as valid.

### Achievement failure after photo success

If a photo is successfully saved but the later achievement is rejected (for example because Material usage exceeds Phase 3C allowance), keep the photo as standalone item-gallery documentation. It may be selected again after the business condition is corrected.

## 12. Existing Flows That Must Remain Unchanged

Phase 3D must not change user-visible content or business behavior of:

- Project Report PDF generation;
- `Copy Report WhatsApp`;
- Project MR lifecycle and approvals;
- Phase 3C MR Approved / Override / Available calculations;
- WO Ops Item/Jasa reports;
- WO Ops photo modal/storage;
- Service Center photos;
- customer/public tracking pages;
- Related WO behavior.

No Project photo count, link, or image is added to PDF or WhatsApp in Phase 3D.

## 13. Cloudinary Backup Integration

Extend the existing Cloudinary Monthly Backup pipeline so Project item photos are included alongside existing WO/Service photos.

Project photo backup organization should remain clearly separated from Ops/Service and be grouped using Project ID plus stable BOQ item identity/metadata.

The backup extension must:

- read Project photo metadata from the new Project table;
- include retained watermarked Cloudinary objects according to the existing backup period rules;
- avoid changing current WO/Service backup output semantics;
- continue using the existing monthly reminder/download-center workflow rather than creating a second backup system.

## 14. UI Error States

The Project Report UI must distinguish at minimum:

- GPS permission denied/unavailable;
- reverse-geocoding failure with GPS still valid;
- image-processing/watermark failure;
- individual Cloudinary upload failure;
- metadata persistence failure;
- selected photo belongs to another item / is deleted;
- achievement rejected by BOQ remain;
- Material achievement rejected by Phase 3C ledger;
- partial success when saving multiple item rows.

A failed item should remain clearly retryable without forcing already successful item rows to be re-entered.

## 15. Verification / UAT Requirements

Implementation is not production-ready until automated tests plus staging/live-safe verification cover at least:

1. Material Input Today with a valid camera photo succeeds.
2. Jasa Input Today with a valid camera photo succeeds.
3. Gallery-source watermark uses upload-time semantics.
4. GPS failure blocks creation/use of a new Project photo.
5. Address lookup failure still allows photo creation with coordinates and fallback text.
6. Input Today without `photo_ids` is rejected server-side.
7. A photo from another BOQ item is rejected server-side.
8. An old active photo from the same item can be linked to a new achievement.
9. One photo can be linked to multiple achievements of the same item.
10. Phase 3C insufficient Material allowance still rejects Input Today.
11. Standalone photo upload does not change Project progress or ledger values.
12. Technician/Manager photo deletion is rejected.
13. Admin/Superadmin soft-delete succeeds and preserves historical links.
14. Per-photo download returns the final watermarked image.
15. Download All contains each active item photo once with no duplicated reused evidence.
16. Project Report PDF output remains unchanged.
17. Copy Report WhatsApp output remains unchanged.
18. WO Ops photo flow remains unchanged.
19. Cloudinary Monthly Backup includes Project item photos without regressing WO/Service backup.
20. Full existing regression suite passes.

## 16. Explicit Non-Goals for Phase 3D

Do not add in Phase 3D:

- Project photos in PDF;
- Project photos or photo counts in WhatsApp reports;
- customer/public Project photo gallery;
- map thumbnail in watermark;
- Google map/logo artwork in watermark;
- AI photo recognition or object detection;
- photo approval workflow;
- synchronization of WO Ops photos into Project photos;
- Project MR formula changes;
- Related WO participation in Project material/photo accounting;
- hard-delete controls for Project photos.

## 17. Implementation Boundary

Expected implementation areas include:

- a Phase 3D migration for Project photo metadata and achievement-photo relation;
- focused Project photo domain/helper code rather than embedding all rules directly into the browser UI;
- `db-core.js` Project photo persistence adapters;
- `server.js` Project photo/signature/download endpoints and atomic achievement-with-photo persistence;
- `public/pxl-stg-0016-project-report.js` photo UI and Input Today integration;
- the user-supplied Pixel watermark logo asset;
- Cloudinary monthly backup code/tests;
- targeted Phase 3D tests plus full regression verification.

Exact task/file decomposition is intentionally deferred to the implementation plan after this written spec is reviewed and approved.
