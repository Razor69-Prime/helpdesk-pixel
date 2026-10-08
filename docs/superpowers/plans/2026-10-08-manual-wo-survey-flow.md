# Manual WO Survey Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make manual WO explicitly typed, add Google Maps, capture technician survey reports, prefill a new SO from completed survey, add WO type filter, and cancel WO without deleting its number.

**Architecture:** Keep existing SO→WO and WO→MR untouched. Store survey report snapshot on the manual Survey ticket, expose a read-only SO draft source endpoint, and let existing Sales Order submission create the actual SO. Link the created SO back to the survey source.

**Tech Stack:** Node/Express, PostgREST/PostgreSQL, vanilla JS/HTML.

**Global Constraints:** No new MR flow. Survey never creates MR directly. No deploy in this revision; push GitHub only. Preserve existing SO→WO behavior exactly.

## Tasks
- [ ] Add failing tests for manual WO type/location, survey report, survey→SO prefill/link, type filter, and cancel semantics.
- [ ] Add migration for ticket survey snapshot/location/cancel fields and SO survey source reference.
- [ ] Update backend endpoints without touching SO→WO or MR routes.
- [ ] Update Input WO and Daftar WO UI plus Survey Report modal.
- [ ] Add Sales Order survey-prefill support while keeping normal SO flow intact.
- [ ] Run VNext tests, syntax and diff checks, then commit and push.
