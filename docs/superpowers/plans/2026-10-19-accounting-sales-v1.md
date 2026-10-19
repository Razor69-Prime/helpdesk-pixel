# Accounting Sales V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun modul standalone `Accounting` khusus Superadmin untuk transaksi penjualan manual, perhitungan DPP/PPN/NET otomatis, dashboard analisa internal, master Accounting lokal, dan export Excel per periode dengan tampilan transaksi semirip mungkin dengan workbook Pixel Buduk.

**Architecture:** Accounting dibuat sebagai subsystem terisolasi dengan tabel database, service/helper, API prefix `/api/accounting/*`, dan bundle UI sendiri. Modul tidak membaca/menulis data bisnis CRM, Sales Order, Inventory, WO, Project, Invoice, atau dashboard global; dependency ke aplikasi existing hanya auth/session dan shell/navigation. Semua perhitungan keuangan dilakukan server-side dan dashboard/export membaca snapshot transaksi Accounting saja.

**Tech Stack:** Node.js >=18, Express 4, existing PostgREST/VPS database adapter, vanilla JS/CSS PixelApps, ExcelJS 4.4.0, built-in Node `assert` untuk unit test ringan.

**Spec:** `docs/superpowers/specs/2026-10-19-accounting-sales-v1-design.md`

## Global Constraints

- Branch implementasi tetap `feature/accounting-sales-v1`; `main` dan VPS production tidak disentuh sampai UAT disetujui.
- Role efektif V1 hanya `superadmin`; semua `/api/accounting/*` wajib server-side gate 403 untuk role lain.
- Accounting tidak boleh membaca/menulis data bisnis modul lain.
- Urutan tabel transaksi wajib: TANGGAL, KLASIFIKASI, SUB KLASIFIKASI, NAMA CUSTOMER - PEKERJAAN, TRANSAKSI, NOMINAL TRANSAKSI, HPP, NET, DPP, PPN, KATEGORI PRODUK, METODE PEMBAYARAN, STATUS PAID, PENJ. BARANG, PENJ. JASA, PIC.
- Accounting hanya menginput Omzet dan HPP sebagai angka sumber; `DPP = omzet / 1.11`, `PPN = omzet - DPP`, `NET = DPP - HPP`, dibulatkan konsisten ke Rupiah integer.
- Dashboard Accounting berada di dalam module Accounting, bukan dashboard global.
- Checklist `accounting_transaction_report` disiapkan di Manajemen Akun sebagai placeholder; V1 tetap tidak memberi akses ke role selain Superadmin.
- Export Excel harus mempertahankan urutan kolom, nama bulan, gaya header oranye/cokelat, teks putih, border/grid, format Rupiah, dan satu sheet per bulan.

## Review Focus

- Client mencoba mengirim nilai DPP/PPN/NET palsu: server harus mengabaikan dan menghitung ulang.
- Role non-Superadmin memanggil API Accounting langsung: seluruh endpoint harus 403.
- Omzet/HPP negatif, enum klasifikasi tidak valid, atau tanggal kosong: transaksi harus ditolak tanpa partial write.
- Rename/nonaktif master Accounting setelah transaksi lama tersimpan: laporan historis harus tetap memakai snapshot transaksi lama.
- Filter periode multi-bulan/export lintas tahun: sheet dan agregat harus mengikuti `transaction_date`, bukan `created_at`.

---

### Task 1: Domain helpers, calculation rules, and isolated database schema

**Files:**
- Create: `accounting-sales-v1.js`
- Create: `PXL-ACC-0001-MIGRATION.sql`
- Create: `tests/accounting-sales-v1.test.js`

**Interfaces:**
- Produces: `calculateAccountingAmounts(grossAmount, hppAmount)`, `normalizeAccountingTransactionInput(input)`, `resolveAccountingClassification(input, customerMaster, picMaster)`, enum constants, dan schema tabel Accounting standalone.
- Consumes: tidak ada dependency bisnis dari modul lain.

- [ ] **Step 1: Write failing unit tests** untuk pembulatan Rupiah, omzet/HPP negatif, enum invalid, server-side recalculation, dan classification precedence customer -> PIC -> manual.
- [ ] **Step 2: Run tests and verify failure** dengan `node tests/accounting-sales-v1.test.js`.
- [ ] **Step 3: Implement pure helpers** di `accounting-sales-v1.js`; fungsi harus mengembalikan integer `gross_amount`, `hpp_amount`, `dpp_amount`, `ppn_amount`, `net_amount` dan tidak menerima hasil kalkulasi client sebagai authoritative.
- [ ] **Step 4: Create migration** untuk `accounting_sales_transactions`, `accounting_customers`, `accounting_pics`, `accounting_product_categories`, `accounting_payment_methods`, serta audit/history delete minimal; tidak membuat foreign key ke tabel bisnis non-Accounting.
- [ ] **Step 5: Run verification**: `node tests/accounting-sales-v1.test.js` dan syntax check SQL secara manual/static review.
- [ ] **Step 6: Commit** sebagai `PXL-ACC-0001A — Accounting domain and schema`.

### Task 2: Accounting data adapter and Superadmin-only API boundary

**Files:**
- Modify: `db.js`
- Modify: `server.js`
- Modify: `tests/accounting-sales-v1.test.js`

**Interfaces:**
- Consumes: helpers Task 1.
- Produces: DB methods untuk transaksi/master Accounting dan API `/api/accounting/transactions`, `/api/accounting/masters/*`, `/api/accounting/dashboard`, `/api/accounting/export` dengan common Superadmin gate.

- [ ] **Step 1: Add failing tests** untuk role normalization/gate helper dan payload normalization yang memastikan non-Superadmin ditolak dan DPP/PPN/NET dihitung server-side.
- [ ] **Step 2: Run tests and verify failure**.
- [ ] **Step 3: Add isolated DB adapter functions** di `db.js`; hanya query tabel berprefix `accounting_` dan tidak memanggil CRM/SO/Inventory/WO/Project/Invoice methods.
- [ ] **Step 4: Add `requireAccountingSuperadmin` middleware** di `server.js`, normalisasi role seperti pola existing, dan pasang ke semua route `/api/accounting/*`.
- [ ] **Step 5: Implement transaction CRUD + masters CRUD** dengan snapshot nama customer/PIC/category/payment pada transaction rows dan audit fields `created_by/updated_by`.
- [ ] **Step 6: Implement delete audit** sesuai schema Task 1; delete hanya Superadmin dan menyimpan snapshot sebelum data aktif dihapus/ditandai deleted.
- [ ] **Step 7: Verify** `node --check server.js`, `node --check db.js`, `node tests/accounting-sales-v1.test.js`.
- [ ] **Step 8: Commit** sebagai `PXL-ACC-0001B — Accounting API and access gate`.

### Task 3: Standalone Accounting shell, permission placeholder, and navigation

**Files:**
- Create: `public/pxl-accounting-sales-v1.js`
- Modify: `public/index.html`

**Interfaces:**
- Consumes: auth/currentUser existing dan API Task 2.
- Produces: menu `Accounting` khusus Superadmin dengan tabs `Dashboard`, `Transaksi Penjualan`, `Master Accounting`; checklist placeholder `accounting_transaction_report` di Manajemen Akun.

- [ ] **Step 1: Add UI guard design assertions** di komentar/test helper agar `canOpenAccounting()` true hanya untuk normalized `superadmin`; placeholder permission tidak boleh membuka modul V1.
- [ ] **Step 2: Implement Accounting menu injection** mengikuti pola navigation existing dan tidak mengubah menu/permission default role lain.
- [ ] **Step 3: Add `Accounting — Laporan Transaksi` checklist** pada Manajemen Akun dengan penjelasan bahwa V1 tetap khusus Superadmin.
- [ ] **Step 4: Add Accounting root/tab containers** dan load `pxl-accounting-sales-v1.js` dari `index.html` tanpa memodifikasi dashboard global.
- [ ] **Step 5: Verify** `node --check public/pxl-accounting-sales-v1.js` serta static check inline JS `index.html`.
- [ ] **Step 6: Commit** sebagai `PXL-ACC-0001C — Accounting shell and navigation`.

### Task 4: Excel-like Transaksi Penjualan UI and input flow

**Files:**
- Modify: `public/pxl-accounting-sales-v1.js`
- Modify: `tests/accounting-sales-v1.test.js`

**Interfaces:**
- Consumes: transaction/master APIs Task 2.
- Produces: monthly spreadsheet-style transaction view, create/edit modal, local auto-classification preview, period filter, search/filter controls.

- [ ] **Step 1: Add tests/assertions** untuk exact 16-column order dan field mapping agar urutan tidak berubah saat refactor.
- [ ] **Step 2: Implement month bar + dense spreadsheet table** dengan header oranye/cokelat, teks putih, border/grid tegas, background putih, Rupiah formatting, dan exact column order dari spec.
- [ ] **Step 3: Implement create/edit form** mengikuti urutan data sumber; user menginput Omzet + HPP, sedangkan NET/DPP/PPN read-only preview dan selalu dikonfirmasi ulang dari response server.
- [ ] **Step 4: Implement local classification suggestion** dari master customer lalu PIC lalu manual, tanpa lookup ke CRM/user Sales existing.
- [ ] **Step 5: Implement PAID/UNPAID, goods/service amounts, category, payment, PIC** sebagai data Accounting lokal saja.
- [ ] **Step 6: Verify** JS syntax, exact headers, create/edit refresh, dan tidak ada request keluar dari `/api/accounting/*` selain auth shell existing.
- [ ] **Step 7: Commit** sebagai `PXL-ACC-0001D — Accounting transaction workbook UI`.

### Task 5: Dashboard Accounting internal

**Files:**
- Modify: `server.js`
- Modify: `public/pxl-accounting-sales-v1.js`
- Modify: `tests/accounting-sales-v1.test.js`

**Interfaces:**
- Consumes: Accounting transaction rows only.
- Produces: dashboard summary/filter API dan UI charts di tab `Dashboard` Accounting.

- [ ] **Step 1: Add aggregation tests** untuk Omzet/HPP/DPP/PPN/NET/jumlah transaksi, classification totals, sub-classification totals, category, PIC, goods-vs-service, NET/classification, dan monthly trend.
- [ ] **Step 2: Implement dashboard aggregation** dari transaction data Accounting berdasarkan `transaction_date` dan filter month/year/classification/sub-classification/PIC/category.
- [ ] **Step 3: Implement summary cards** Omzet, HPP, DPP, PPN, NET, jumlah transaksi.
- [ ] **Step 4: Implement charts**: Omzet per Klasifikasi, Jumlah Transaksi per Klasifikasi, Omzet per Sub Klasifikasi, Omzet per Kategori Produk, Barang vs Jasa, Omzet per PIC, NET per Klasifikasi, Trend Omzet Bulanan.
- [ ] **Step 5: Verify** edit/delete transaksi langsung mengubah aggregate setelah refresh dan dashboard global PixelApps tidak berubah.
- [ ] **Step 6: Commit** sebagai `PXL-ACC-0001E — Accounting dashboard`.

### Task 6: Excel export matching workbook layout

**Files:**
- Modify: `server.js`
- Modify: `accounting-sales-v1.js`
- Modify: `tests/accounting-sales-v1.test.js`

**Interfaces:**
- Consumes: filtered Accounting transactions dan ExcelJS existing dependency.
- Produces: `.xlsx` satu atau multi-bulan, satu sheet per bulan dengan style workbook sumber.

- [ ] **Step 1: Add export mapping tests** untuk exact 16 columns, month sheet naming, transaction-date grouping, dan integer Rupiah values.
- [ ] **Step 2: Implement workbook builder** dengan bar bulan, header oranye/cokelat, white header text, border/grid, Rupiah number format, column widths, dan exact column order.
- [ ] **Step 3: Implement single/multi-month endpoint** `/api/accounting/export` yang hanya mengambil Accounting data dan mengurutkan transaksi berdasarkan `transaction_date`.
- [ ] **Step 4: Verify generated workbook** dengan ExcelJS round-trip read: sheet names, header order, sample formula-result values, styles yang diwajibkan.
- [ ] **Step 5: Commit** sebagai `PXL-ACC-0001F — Accounting Excel export`.

### Task 7: Isolation, regression, and UAT readiness

**Files:**
- Modify as required only to fix Accounting defects discovered by verification.
- Create: `README-PXL-ACC-0001.txt`

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: UAT-ready branch with documented migration, test steps, rollback boundary, and no production deployment.

- [ ] **Step 1: Run complete static verification**: `node --check server.js`, `node --check db.js`, `node --check accounting-sales-v1.js`, `node --check public/pxl-accounting-sales-v1.js`, `node tests/accounting-sales-v1.test.js`.
- [ ] **Step 2: Search changed code for forbidden business dependencies** (`crm`, `sales_orders`, `inventory`, `work_order`, `project`, `invoice`) and confirm no Accounting read/write path targets those modules; auth/navigation references are allowed.
- [ ] **Step 3: Verify API access matrix**: Superadmin 2xx as appropriate; Admin/Manager/HR/Accounting/Sales/Teknisi get 403 on all `/api/accounting/*` endpoints.
- [ ] **Step 4: Verify sample arithmetic** e.g. Omzet Rp10.000.000 + HPP Rp6.000.000 -> DPP Rp9.009.009, PPN Rp990.991, NET Rp3.009.009 after integer rounding policy.
- [ ] **Step 5: Verify UI/export exact column order** and visual checklist against sample workbook Agustus/September.
- [ ] **Step 6: Write `README-PXL-ACC-0001.txt`** with migration command, staging/UAT checklist, rollback notes, changed files, and explicit statement `main/production not touched`.
- [ ] **Step 7: Commit** as `PXL-ACC-0001 — Accounting Sales V1 UAT candidate`.

## Self-review result

- Spec coverage: all acceptance criteria mapped to Tasks 1-7.
- Isolation: dedicated tables/API/UI; no business-data dependency outside Accounting.
- Access: menu and backend both Superadmin-only; checklist is placeholder only.
- Calculation integrity: server is authoritative for DPP/PPN/NET.
- Historical integrity: transaction snapshots decouple historical reports from master edits.
- Dashboard scope: internal Accounting only; no changes to global KPI/dashboard.
- Production safety: branch-only until UAT approval.
