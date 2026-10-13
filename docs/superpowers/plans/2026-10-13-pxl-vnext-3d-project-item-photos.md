# PXL-VNEXT-3D Project Item Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add internal GPS-watermarked photo documentation per Project BOQ item and require at least one valid same-item photo for every new `Input Today > 0`, while preserving the Phase 3C material ledger and all existing PDF/WhatsApp/Ops flows.

**Architecture:** Keep image resize, compression, GPS capture, reverse-geocoding, watermark rendering, and Cloudinary upload in the browser so the VPS only handles authorization, metadata, evidence validation, atomic achievement/photo linking, downloads, and backup. Store photos in Project-specific tables and link them many-to-many to `project_report_item_achievements`; use a PostgreSQL RPC so an achievement and its photo links commit atomically. Reuse the existing Cloudinary signed-upload and monthly-backup patterns; add one focused browser module rather than expanding the already-large Project Report file with image-processing internals.

**Tech Stack:** Node.js/CommonJS, Express, PostgreSQL/PostgREST RPC, browser Canvas + Geolocation API, Cloudinary signed upload via `fetch`, `node-fetch`, `archiver` for streaming ZIP, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-12-pxl-vnext-3d-project-item-photo-design.md`

## Global Constraints

- Phase 3C remains authoritative: Material must still satisfy both BOQ remain and `Total Done + requested Input Today <= MR Approved + active Override`.
- Jasa remains outside Project MR.
- Related WO remains reference-only; Project photos never use WO Ops photo tables.
- Every new Project item achievement requires at least one active photo from the exact same `project_report_item_id`.
- Existing active photos from that item may be reused and one photo may link to multiple achievements without duplicating the Cloudinary file.
- GPS latitude/longitude is mandatory for every new Project photo; reverse-geocoded address is best-effort with `Alamat tidak tersedia` fallback.
- Camera uses `Lokasi/Waktu Dokumentasi`; gallery uses `Lokasi/Waktu Upload`.
- Longest image side is 1920 px; preserve aspect ratio and encode high-quality JPEG at quality `0.88` before watermark/upload.
- Upload only the final watermarked image; never persist the unwatermarked original.
- Use the exact user-supplied 500x500 RGBA Pixel Solusindo logo, SHA-256 `a1da27cef2343e71e5d08b70657af3af71d4fa90e873a098ac0bedd5f7ce0bb3`, as `public/assets/pxl-vnext-3d-watermark-logo.png`.
- No fixed photo-count limit; process selected files sequentially with per-file progress and partial success.
- Upload roles: Technician, Manager, Admin, Superadmin, subject to existing Project Report access. Delete roles: Admin and Superadmin only.
- Soft-delete only. Historical achievement-photo links remain and historical achievements are never changed by photo deletion.
- Project photos remain internal only; no customer/public visibility.
- Project Report PDF and Copy Report WhatsApp must remain byte/content-flow compatible apart from unrelated version markers; do not add photo counts, links, or images.
- WO Ops and Service photo flows must remain unchanged.
- Download All is streamed on demand; do not leave ZIP files on VPS disk.
- Extend the existing Cloudinary Monthly Backup rather than creating a second backup system.

## Review Focus

- Reject mixed `photo_ids` containing one valid same-item photo plus one foreign/deleted photo; do not silently ignore invalid IDs.
- Deduplicate repeated photo IDs in one request so the RPC unique constraint is not triggered by client duplication.
- Preserve successful standalone uploads when later achievement validation fails or when sibling item rows fail.
- Soft-deleting a historically linked photo must preserve link rows and leave Total Done/ledger values unchanged.
- Download All must include each active photo exactly once even when the same photo is linked to multiple achievements, and must not write a temporary ZIP file.

---

### Task 1: Photo schema, atomic RPC, and pure validation helpers

**Files:**
- Create: `PXL-VNEXT-3D-MIGRATION.sql`
- Create: `project-vnext-3d.js`
- Create: `tests/vnext-3d-migration.test.js`
- Create: `tests/vnext-3d-photo-core.test.js`

**Interfaces:**
- Produces SQL tables `project_report_item_photos`, `project_report_achievement_photos` and RPC `pxl_vnext_3d_create_project_achievement_with_photos`.
- Produces `normalizePhotoIds(photoIds)`, `validateProjectPhotoEvidence({itemId,photoIds,photos})`, `isProjectPhotoUploadRole(role)`, `isProjectPhotoDeleteRole(role)`, and `safeProjectPhotoFilename(value)` from `project-vnext-3d.js`.

- [ ] **Step 1: Write failing schema and core tests**

```js
// tests/vnext-3d-photo-core.test.js
assert.deepEqual(normalizePhotoIds(['a','a',' b ','']),['a','b']);
assert.equal(validateProjectPhotoEvidence({itemId:'i1',photoIds:['p1'],photos:[{id:'p1',project_report_item_id:'i1',deleted_at:null}]}).ok,true);
assert.equal(validateProjectPhotoEvidence({itemId:'i1',photoIds:['p1','p2'],photos:[{id:'p1',project_report_item_id:'i1',deleted_at:null},{id:'p2',project_report_item_id:'i2',deleted_at:null}]}).ok,false);
assert.equal(isProjectPhotoDeleteRole('technician'),false);
assert.equal(isProjectPhotoDeleteRole('admin'),true);
```

`tests/vnext-3d-migration.test.js` must assert both tables, FKs/indexes, `(achievement_id,photo_id)` uniqueness, `deleted_at`, source/time-semantics checks, and the atomic RPC exist.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/vnext-3d-migration.test.js tests/vnext-3d-photo-core.test.js`
Expected: FAIL because the migration/module do not exist.

- [ ] **Step 3: Implement migration and pure helpers**

The RPC signature is:

`pxl_vnext_3d_create_project_achievement_with_photos(p_item_id uuid, p_achievement numeric, p_achievement_date date, p_notes text, p_actor text, p_actor_id text, p_photo_ids jsonb) returns uuid`

The RPC must reject an empty list, reject any missing/deleted/foreign-item photo, deduplicate IDs, insert one `project_report_item_achievements` row, insert all link rows, and return the new achievement UUID in the same database transaction.

- [ ] **Step 4: Run tests and syntax check**

Run: `node --test tests/vnext-3d-migration.test.js tests/vnext-3d-photo-core.test.js && node --check project-vnext-3d.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add PXL-VNEXT-3D-MIGRATION.sql project-vnext-3d.js tests/vnext-3d-migration.test.js tests/vnext-3d-photo-core.test.js
git commit -m "feat: add project photo schema and evidence core"
```

### Task 2: DB adapters for Project photos and atomic achievement creation

**Files:**
- Modify: `db-core.js:916-936`
- Modify: `db-core.js:1490-1530`
- Create: `tests/vnext-3d-photo-db.test.js`

**Interfaces:**
- Consumes: RPC/table names from Task 1.
- Produces:
  - `getProjectReportItemPhotos({projectId=null,itemId=null,includeDeleted=false}={})`
  - `getProjectReportItemPhoto(id,{includeDeleted=false}={})`
  - `insertProjectReportItemPhoto(data)`
  - `softDeleteProjectReportItemPhoto(id,patch)`
  - `getProjectReportAchievementPhotoLinks({achievementId=null,photoIds=[]}={})`
  - `createProjectReportItemAchievementWithPhotos({itemId,achievementDate,achievement,notes,actor,actorId,photoIds})`

- [ ] **Step 1: Write failing DB adapter test**

Test source contracts: active queries default to `deleted_at=is.null`, backup can request deleted rows with `includeDeleted:true`, the create adapter posts to `/rpc/pxl_vnext_3d_create_project_achievement_with_photos`, and all six adapters are exported.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3d-photo-db.test.js`
Expected: FAIL on missing adapter names.

- [ ] **Step 3: Implement minimal PostgREST adapters**

Keep the existing Project Report local-mode convention (`[]`/synthetic row when PostgREST is disabled); do not introduce a second local persistence store.

- [ ] **Step 4: Run targeted tests**

Run: `node --test tests/vnext-3d-photo-db.test.js tests/vnext-3c-project-report-ledger.test.js && node --check db-core.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db-core.js tests/vnext-3d-photo-db.test.js
git commit -m "feat: add project photo database adapters"
```

### Task 3: Project photo permissions, signed upload, metadata, gallery, and soft-delete API

**Files:**
- Modify: `server.js:51-60`
- Modify: `server.js:1166-1200`
- Modify: `server.js:1980-2050`
- Create: `tests/vnext-3d-photo-api.test.js`

**Interfaces:**
- Consumes: Task 1 role helpers and Task 2 DB adapters.
- Produces middleware `requireProjectPhotoUpload`, helper `destroyCloudinaryImage(publicId)`, and routes:
  - `GET /api/project-report-items/:id/photos`
  - `POST /api/project-report-items/:id/photos/signature`
  - `POST /api/project-report-items/:id/photos`
  - `DELETE /api/project-report-items/:id/photos/:photoId`

- [ ] **Step 1: Write failing API source-contract tests**

Assert that read uses `requireProjectReportRead`; upload requires Project access plus Technician/Manager/Admin/Superadmin role; delete allows only Admin/Superadmin; signature public IDs are Project-specific and do not use item names; metadata POST derives `project_id` and Project ID/project number from server-side rows, requires finite lat/lng, accepts only `camera|gallery`, and forces matching `documentation|upload` time semantics.

Also assert metadata persistence failure calls Cloudinary cleanup and never returns a valid photo record.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3d-photo-api.test.js`
Expected: FAIL on missing routes/helpers.

- [ ] **Step 3: Implement photo API**

`destroyCloudinaryImage(publicId)` must use the existing Cloudinary credentials/signature helper and `node-fetch` against Cloudinary's image destroy endpoint; do not add the Cloudinary SDK.

Metadata POST persists `address_text='Alamat tidak tersedia'` when address lookup failed client-side and stores uploader IDs/names from the session, never from client input.

- [ ] **Step 4: Run targeted regression**

Run: `node --test tests/vnext-3d-photo-api.test.js tests/vnext-3c-material-override-api.test.js tests/vnext-3b2-project-mr-permissions.test.js && node --check server.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server.js tests/vnext-3d-photo-api.test.js
git commit -m "feat: add project photo upload and gallery api"
```

### Task 4: Enforce photo evidence in Input Today without weakening 3C

**Files:**
- Modify: `server.js:2007-2030`
- Create: `tests/vnext-3d-achievement-photo-api.test.js`

**Interfaces:**
- Consumes: `normalizePhotoIds`, `validateProjectPhotoEvidence`, `getProjectReportItemPhotos`, and `createProjectReportItemAchievementWithPhotos`.
- Produces the extended POST contract `{achievement, achievement_date, notes?, photo_ids}` for `/api/project-report-items/:id/achievements`.

- [ ] **Step 1: Write failing evidence tests**

The test must pin these conditions: missing/empty `photo_ids` rejected; mixed valid+foreign IDs rejected; deleted IDs rejected; duplicate same-item IDs are deduplicated; Material still calls `getFreshProjectMaterialUsageState` and `checkProjectMaterialUsage`; successful path calls the atomic DB adapter instead of `insertProjectReportItemAchievement`.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3d-achievement-photo-api.test.js`
Expected: FAIL because the route still accepts achievements without photos.

- [ ] **Step 3: Extend the existing achievement route**

Preserve the current order of business validation: item/achievement -> fresh Material state or Jasa history -> BOQ cap -> Phase 3C Material usage cap -> photo evidence validation -> atomic RPC. A rejected achievement leaves previously uploaded photos as standalone gallery records.

- [ ] **Step 4: Run 3C + 3D route tests**

Run: `node --test tests/vnext-3d-achievement-photo-api.test.js tests/vnext-3c-project-usage-limit.test.js tests/vnext-3c-project-report-ledger.test.js tests/vnext-3c-ledger-core.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server.js tests/vnext-3d-achievement-photo-api.test.js
git commit -m "feat: require project photo evidence for input today"
```

### Task 5: Browser photo processor, GPS, watermark, Cloudinary upload, and exact logo asset

**Files:**
- Create: `public/pxl-vnext-3d-project-photos.js`
- Create binary asset: `public/assets/pxl-vnext-3d-watermark-logo.png`
- Create: `tests/vnext-3d-photo-client.test.js`

**Interfaces:**
- Produces `window.PXLProjectPhotos.open({project,item,user,selectedPhotoIds,onSelectionChange})` and `window.PXLProjectPhotos.revision === 'PXL-VNEXT-3D'`.
- The module owns modal creation, two explicit inputs (`capture="environment"` camera and normal multi-file gallery), GPS/reverse-geocode, Canvas processing, sequential upload, gallery refresh, evidence checkboxes, and per-file retry messaging.

- [ ] **Step 1: Write failing client contract test**

Assert the module contains: max dimension `1920`, JPEG quality `0.88`, `navigator.geolocation.getCurrentPosition`, address fallback `Alamat tidak tersedia`, separate `camera`/`gallery` inputs, source-specific `Lokasi/Waktu Dokumentasi` and `Lokasi/Waktu Upload`, the dedicated logo path, sequential per-file processing, and no reference to item name/project name when constructing watermark text.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3d-photo-client.test.js`
Expected: FAIL because module/asset do not exist.

- [ ] **Step 3: Add the exact supplied logo asset**

Copy the user-supplied image byte-for-byte and verify:

```bash
sha256sum public/assets/pxl-vnext-3d-watermark-logo.png
# a1da27cef2343e71e5d08b70657af3af71d4fa90e873a098ac0bedd5f7ce0bb3
```

- [ ] **Step 4: Implement browser photo module**

Render a semi-transparent upper watermark containing only: exact Pixel logo, Project ID/project number, locality if available, address/fallback, lat/lng, date/time, current user, and source-appropriate semantics. Resize before watermark and upload only the final Blob.

A newly uploaded photo should be auto-selected as current evidence, while standalone gallery usage remains harmless when no Input Today value is entered.

- [ ] **Step 5: Run client test and syntax check**

Run: `node --test tests/vnext-3d-photo-client.test.js && node --check public/pxl-vnext-3d-project-photos.js && sha256sum public/assets/pxl-vnext-3d-watermark-logo.png`
Expected: PASS and exact SHA-256 match.

- [ ] **Step 6: Commit**

```bash
git add public/pxl-vnext-3d-project-photos.js public/assets/pxl-vnext-3d-watermark-logo.png tests/vnext-3d-photo-client.test.js
git commit -m "feat: add project photo watermark client"
```

### Task 6: Project Report gallery/evidence UI and per-item independent save

**Files:**
- Modify: `public/pxl-stg-0016-project-report.js:114-160`
- Create: `tests/vnext-3d-project-report-ui.test.js`

**Interfaces:**
- Consumes: `window.PXLProjectPhotos.open(...)`.
- Produces `selectedPhotoIdsByItem` state in the Project Report module and sends `photo_ids` with each item achievement request.

- [ ] **Step 1: Write failing UI behavior test**

Assert every Material/Jasa row renders `📷 Foto`; clicking opens Task 5 module for the exact item; `Input Today > 0` with no selected evidence is rejected client-side for only that row; each achievement POST includes `{...,photo_ids:[...]}`; successful rows clear their own input/evidence state while failed sibling rows remain retryable.

Also pin that existing `Copy Report WhatsApp` and PDF-generation functions do not reference Project photo state or photo URLs.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3d-project-report-ui.test.js tests/vnext-3c-project-report-ui.test.js`
Expected: new test FAIL, 3C test stays PASS.

- [ ] **Step 3: Integrate item photo state into active Project Report UI**

Do not move the 3C ledger math or change `mr_approved_qty`, `override_qty`, `usage_limit`, `available_for_use`, BOQ remain, history, PDF, or WhatsApp logic.

- [ ] **Step 4: Run UI tests**

Run: `node --test tests/vnext-3d-project-report-ui.test.js tests/vnext-3c-project-report-ui.test.js tests/vnext-3c-project-usage-limit.test.js && node --check public/pxl-stg-0016-project-report.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/pxl-stg-0016-project-report.js tests/vnext-3d-project-report-ui.test.js
git commit -m "feat: integrate project photos with input today"
```

### Task 7: Per-photo download and streaming Download Semua Foto

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `server.js`
- Modify: `project-vnext-3d.js`
- Create: `tests/vnext-3d-photo-download.test.js`

**Interfaces:**
- Adds dependency `archiver`.
- Produces routes:
  - `GET /api/project-report-item-photos/:photoId/download`
  - `GET /api/project-report-items/:id/photos/download-all`
- Produces `projectPhotoZipFilename({projectNumber,itemId})` and stable per-entry naming helper(s) in `project-vnext-3d.js`.

- [ ] **Step 1: Write failing download tests**

Assert single-photo download is internal/authenticated, excludes soft-deleted photos, proxies the watermarked Cloudinary object with attachment headers, and never serves an original URL variant.

Assert Download All deduplicates by photo ID/public ID, filters soft-deleted photos, uses `archiver('zip',...)`, streams response bodies from Cloudinary, and contains no `fs.writeFileSync`, temp ZIP path, or persistent ZIP output in the route.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3d-photo-download.test.js`
Expected: FAIL on missing routes/dependency.

- [ ] **Step 3: Add `archiver` and implement downloads**

Use filesystem-safe names containing Project ID, stable item ID/date, and original/generated filename where available. Reused evidence appears once because the source list is the active item gallery, not achievement-link rows.

- [ ] **Step 4: Run download/API regression**

Run: `node --test tests/vnext-3d-photo-download.test.js tests/vnext-3d-photo-api.test.js && node --check server.js && node --check project-vnext-3d.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json server.js project-vnext-3d.js tests/vnext-3d-photo-download.test.js
git commit -m "feat: add project photo downloads"
```

### Task 8: Extend Cloudinary Monthly Backup for Project photos

**Files:**
- Modify: `ops/backup/cloudinary-backup-lib.js`
- Modify: `ops/backup/cloudinary-backup.js`
- Create: `tests/vnext-3d-cloudinary-backup.test.js`

**Interfaces:**
- Produces `projectRelativePath(project,item)` from backup lib.
- Consumes `db.getProjectReportItemPhotos({includeDeleted:true})` so retained historically-linked soft-deleted objects can still be archived while they remain in Cloudinary.

- [ ] **Step 1: Write failing backup tests**

Assert Project backup paths are separate from `WO` and `SERVICE`, grouped under a `PROJECT/<project-id>/ITEM/<item-id>` style safe path, and `recordDate` can use `evidence_time`/`uploaded_at` for Project photos.

Assert backup script increments a Project counter, writes Project/item metadata JSON plus watermarked photo files, does not generate/modify the live Project Report PDF, and leaves existing WO/Service branches intact.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3d-cloudinary-backup.test.js`
Expected: FAIL on missing Project backup path/branch.

- [ ] **Step 3: Extend the existing backup pipeline**

Bulk-load Projects, Project BOQ items, and Project photos once per backup run; group in memory to avoid N+1 metadata queries. Preserve existing weekly/monthly period behavior and monthly reminder/download-center flow.

- [ ] **Step 4: Run backup regression**

Run: `node --test tests/vnext-3d-cloudinary-backup.test.js && node --check ops/backup/cloudinary-backup-lib.js && node --check ops/backup/cloudinary-backup.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ops/backup/cloudinary-backup-lib.js ops/backup/cloudinary-backup.js tests/vnext-3d-cloudinary-backup.test.js
git commit -m "feat: include project photos in cloudinary backup"
```

### Task 9: Asset wiring, service-worker revision, final regression, and deployment readiness

**Files:**
- Modify: `public/index.html:13222`
- Modify: `public/sw.js:1-2`
- Create: `tests/vnext-3d-asset-wiring.test.js`

**Interfaces:**
- Loads `/pxl-vnext-3d-project-photos.js?v=PXL-VNEXT-3D` before `/pxl-stg-0016-project-report.js?v=PXL-VNEXT-3D`.
- Bumps service-worker cache from `pixelapps-inv1-v113` to `pixelapps-inv1-v114` and includes the new Project photo module/logo in cacheable assets without altering API bypass behavior.

- [ ] **Step 1: Write failing asset-wiring test**

Assert script order, `PXL-VNEXT-3D` revision tags, cache version `v114`, new logo/module paths, and unchanged `/api/` network bypass.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/vnext-3d-asset-wiring.test.js`
Expected: FAIL before wiring/version bump.

- [ ] **Step 3: Wire assets and bump cache revision**

Do not modify unrelated service-worker HTML patch/injection rules.

- [ ] **Step 4: Run all automated tests and syntax checks**

Run:

```bash
node --test tests/*.test.js
node --check project-vnext-3d.js
node --check db-core.js
node --check server.js
node --check public/pxl-vnext-3d-project-photos.js
node --check public/pxl-stg-0016-project-report.js
node --check ops/backup/cloudinary-backup.js
node --check ops/backup/cloudinary-backup-lib.js
sha256sum public/assets/pxl-vnext-3d-watermark-logo.png
```

Expected: all tests PASS, all syntax checks exit 0, logo SHA equals the locked hash.

- [ ] **Step 5: Run migration safety checks before any production apply**

On a disposable/staging transaction first: apply `PXL-VNEXT-3D-MIGRATION.sql`, verify both tables/RPC exist, test rollback, and confirm existing production business-row counts are unchanged. Before real production migration create a PostgreSQL 17 dump using `/usr/lib/postgresql/17/bin/pg_dump` and preserve `/var/www/internal.pixelsolusindo.com/backups/` and `public/downloads/`.

- [ ] **Step 6: Browser UAT before production promotion**

Verify at minimum: camera photo + Material Input Today; camera photo + Jasa; gallery upload semantics; GPS-denied block; address fallback; existing-photo reuse; same photo reused on two achievements; cross-item rejection; insufficient 3C Material allowance rejection; standalone gallery no progress change; Technician delete denied; Admin soft-delete; per-photo download; Download All no duplicates; PDF unchanged; WhatsApp unchanged; WO Ops photo unchanged; backup dry-run includes Project photos.

- [ ] **Step 7: Commit final wiring**

```bash
git add public/index.html public/sw.js tests/vnext-3d-asset-wiring.test.js
git commit -m "chore: wire PXL-VNEXT-3D assets"
```

## Plan Self-Review Result

- Spec coverage: all locked rules map to Tasks 1-9; no photo approval/customer/PDF/WhatsApp scope added.
- Type/interface consistency: DB/RPC names and browser module API are consistent across tasks.
- Review-focus coverage: mixed invalid IDs (Tasks 1/4), duplicate IDs (Tasks 1/4), partial success (Tasks 3/6), historical soft-delete (Tasks 1/3), ZIP dedupe/no temp file (Task 7).
- Phase 3C isolation: Tasks 4/6 explicitly preserve existing fresh-ledger checks and Task 9 runs the entire test suite.
- Deployment safety: production migration is gated behind PostgreSQL 17 backup, dry-run/rollback, full regression, and browser UAT; protected untracked production directories are preserved.
