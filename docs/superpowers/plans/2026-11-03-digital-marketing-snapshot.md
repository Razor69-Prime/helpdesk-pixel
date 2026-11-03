# Digital Marketing Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local PixelApps Digital Marketing monthly snapshot module fed read-only from Marketing Apps.
**Architecture:** PHP CLI source reader uses Marketing Apps MySQL credentials but enforces `START TRANSACTION READ ONLY` and hard-coded SELECTs. Node API persists only to PixelApps PostgREST tables, exposes snapshot/pull endpoints, injects the UI loader, and schedules current-month pull at 04:00 WITA.
**Tech Stack:** Node.js/Express, PHP PDO/MySQL, PostgreSQL/PostgREST, browser JavaScript.
**Spec:** `docs/superpowers/specs/2026-11-03-digital-marketing-snapshot-design.md`

## Global Constraints
- Marketing Apps MUST remain read-only.
- No AI call in Phase 1.
- Historical monthly snapshots remain available for comparison.
- Auto pull is 04:00 Asia/Makassar daily.

## Review Focus
- Source connector cannot issue write SQL.
- Invalid period cannot reach source DB.
- Past snapshots are not overwritten by scheduled pull.
- Failed source pull preserves last successful snapshot.
- Current vs previous month comparison handles missing prior data.

### Task 1: Read-only source connector
Create `pxl-dm-marketing-reader.php` and tests proving read-only transaction + SELECT-only source.

### Task 2: PixelApps snapshot API and persistence
Create migration + `pxl-dm-0001-api.js`; current month upserts locally, history records pull outcomes, past months close.

### Task 3: Digital Marketing UI
Create `public/pxl-dm-0001.js` and page shell injected into PixelApps; display monthly summary/comparison/history and manual pull.

### Task 4: 04:00 WITA scheduler and regression checks
Schedule current-month pull; run focused tests and static checks. Do not merge/push/deploy from the isolated worktree.
