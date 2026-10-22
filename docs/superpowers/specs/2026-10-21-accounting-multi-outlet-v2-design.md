# PXL-ACC-0002 — Accounting Multi-Outlet V2 Design

Tanggal: 21 Oktober 2026
Status: Design approved in chat; written spec pending final user review
Base production: `a9853338fdc8a79e96421924313bf31f770ec9d1`
Branch: `feature/accounting-multi-outlet-v2`

## 1. Tujuan

Mengembangkan modul Accounting Sales V1 menjadi Accounting Multi-Outlet yang mendukung tiga outlet Pixel Solusindo:

- Buduk
- Lukluk
- Bangli

Setiap outlet memiliki transaksi dan master Accounting masing-masing, sementara dashboard/report dapat dilihat dalam dua mode:

1. Gabungan semua outlet.
2. Per outlet.

Fase ini hanya menyiapkan struktur, UI, API, dashboard, master, dan export multi-outlet. Inject/import workbook transaksi lama dilakukan pada fase terpisah setelah fitur multi-outlet lulus UAT.

## 2. Prinsip Arsitektur

Dipilih Opsi A: satu subsystem Accounting dengan `outlet_id` sebagai partition key logis.

Tidak dibuat tabel terpisah per outlet dan tidak dibuat database/schema terpisah per outlet.

Keuntungan:

- struktur lebih sederhana dan mudah dirawat;
- dashboard gabungan lebih mudah dihitung;
- transaksi tetap memiliki asal outlet yang jelas;
- penambahan outlet baru di masa depan cukup melalui master outlet;
- fitur existing Accounting V1 dapat diperluas tanpa ditulis ulang.

## 3. Scope

### 3.1 In scope

- Master outlet Buduk, Lukluk, Bangli.
- Selector outlet di modul Accounting.
- Mode `Semua Outlet` untuk dashboard/report gabungan.
- Mode Buduk/Lukluk/Bangli untuk dashboard, transaksi, master, dan export outlet tertentu.
- `outlet_id` pada transaksi Accounting.
- `outlet_id` pada master Customer, PIC, Kategori Produk, dan Metode Pembayaran.
- Master sepenuhnya terpisah per outlet.
- PIC sepenuhnya terpisah per outlet.
- Dashboard gabungan + breakdown per outlet.
- Dashboard per outlet.
- Export per outlet dan export gabungan.
- Server-side validation agar transaksi/master tidak bocor antar outlet.
- Migration additive dari Accounting V1 production.
- Regression test terhadap Accounting V1 dan module terkait.

### 3.2 Out of scope

- Inject workbook Buduk/Lukluk/Bangli.
- Sinkronisasi Accounting dengan CRM, Sales Order, Inventory, Work Order, Project, atau Invoice.
- Role selain Superadmin.
- Permission outlet-level untuk user tertentu.
- Auto-assignment outlet berdasarkan user login.
- Consolidation accounting formal seperti jurnal umum, neraca, arus kas, atau buku besar.

## 4. Model Data

### 4.1 Tabel baru: `accounting_outlets`

Kolom minimum:

- `id uuid primary key`
- `code text not null unique`
- `name text not null unique`
- `is_active boolean not null default true`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Seed:

- `BUDUK` / Buduk
- `LUKLUK` / Lukluk
- `BANGLI` / Bangli

Urutan tampilan default: Buduk, Lukluk, Bangli.

### 4.2 Penambahan `outlet_id`

Tambahkan `outlet_id uuid` ke:

- `accounting_sales_transactions`
- `accounting_customers`
- `accounting_pics`
- `accounting_product_categories`
- `accounting_payment_methods`

`outlet_id` harus menjadi foreign key ke `accounting_outlets(id)`.

Untuk transaksi dan master baru setelah migration, `outlet_id` wajib terisi.

### 4.3 Uniqueness per outlet

Master tidak lagi unique secara global berdasarkan `name`. Uniqueness menjadi scoped per outlet melalui unique index berbasis ekspresi:

- `(outlet_id, lower(name))` untuk Customer
- `(outlet_id, lower(name))` untuk PIC
- `(outlet_id, lower(name))` untuk Kategori Produk
- `(outlet_id, lower(name))` untuk Metode Pembayaran

Nama yang sama boleh digunakan di outlet berbeda.

Contoh:

- Buduk / CCTV
- Lukluk / CCTV
- Bangli / CCTV

Ketiganya record berbeda.

### 4.4 Existing data V1 dan migration guard

Sistem tidak boleh menebak outlet untuk data existing.

Sebelum perubahan schema irreversible di migration, lakukan guard terhadap data Accounting V1:

- Jika `accounting_sales_transactions` memiliki row tanpa outlet mapping, migration harus berhenti dan meminta proses mapping eksplisit terlebih dahulu.
- Jika `accounting_customers` atau `accounting_pics` memiliki row existing tanpa outlet mapping, migration harus berhenti agar Customer/PIC tidak salah dimasukkan ke outlet tertentu.
- `accounting_product_categories` dan `accounting_payment_methods` seed V1 boleh diduplikasi secara deterministic ke Buduk, Lukluk, dan Bangli karena keduanya adalah master dasar yang memang dibutuhkan setiap outlet.

Untuk seed Kategori Produk dan Metode Pembayaran V1:

1. Simpan nama master existing.
2. Lepas global unique constraint/index `name` terlebih dahulu.
3. Isi `outlet_id` pada row existing untuk satu outlet secara deterministic atau rebuild set seed dalam transaction.
4. Buat copy nama yang sama untuk dua outlet lain.
5. Pasang unique index `(outlet_id, lower(name))`.
6. Pastikan semua row memiliki `outlet_id` sebelum `NOT NULL` diaktifkan.

Migration harus idempotent dan aman dijalankan terlebih dahulu di staging.

## 5. Master per Outlet

Empat master berikut wajib terpisah per outlet:

- Customer
- PIC
- Kategori Produk
- Metode Pembayaran

Saat user memilih Buduk, hanya master Buduk yang tampil dan dapat dipilih pada transaksi Buduk. Hal yang sama berlaku untuk Lukluk dan Bangli.

Master tidak pernah ditampilkan lintas outlet pada form transaksi outlet tertentu.

## 6. PIC per Outlet

PIC dapat berbeda-beda per outlet.

Nama PIC yang sama boleh ada di beberapa outlet, tetapi setiap record tetap berbeda berdasarkan `outlet_id`.

Contoh:

- Buduk / Eka
- Lukluk / Eka

Keduanya tidak dianggap record yang sama.

Dashboard per PIC selalu dihitung dalam konteks outlet aktif. Dashboard gabungan tidak boleh menggabungkan dua PIC bernama sama dari outlet berbeda tanpa identitas outlet.

## 7. Selector Outlet dan Mode UI

Di bagian atas modul Accounting tersedia selector:

- Semua Outlet
- Buduk
- Lukluk
- Bangli

### 7.1 Mode Semua Outlet

Diperbolehkan untuk:

- Dashboard gabungan
- Report gabungan
- Export gabungan

Tidak diperbolehkan untuk:

- Membuat transaksi
- Mengedit transaksi
- Menghapus transaksi
- Membuat/mengedit/menghapus master

Tujuannya mencegah data baru dibuat tanpa outlet yang jelas.

### 7.2 Mode Per Outlet

Saat outlet Buduk/Lukluk/Bangli aktif:

- Dashboard difilter outlet tersebut.
- Daftar transaksi hanya outlet tersebut.
- Create transaksi otomatis memakai outlet aktif.
- Edit/delete harus memastikan transaksi memang milik outlet aktif.
- Semua master hanya outlet tersebut.
- Export hanya outlet tersebut.

Outlet tidak perlu dipilih ulang di dalam form transaksi karena diturunkan dari context selector.

## 8. API Contract

Semua endpoint tetap di bawah prefix `/api/accounting/*` dan tetap Superadmin-only.

### 8.1 Outlet master

Endpoint baru minimum:

- `GET /api/accounting/outlets`

V2 tidak membutuhkan CRUD outlet dari UI; tiga outlet awal dianggap konfigurasi sistem.

### 8.2 Transaksi

Endpoint transaksi menerima filter outlet:

- `GET /api/accounting/transactions?outlet_id=<uuid>`
- `POST /api/accounting/transactions`
- `PATCH /api/accounting/transactions/:id`
- `DELETE /api/accounting/transactions/:id`

Create wajib membawa `outlet_id` valid.

Patch/delete wajib melakukan ownership check terhadap transaksi target jika request membawa context outlet.

`outlet_id` tidak boleh diubah lewat edit transaksi biasa. Pindah transaksi antar outlet tidak termasuk scope V2.

### 8.3 Master

Endpoint existing `/api/accounting/masters/:type` wajib menerima `outlet_id` dan men-scope seluruh query berdasarkan outlet.

Create master wajib memiliki `outlet_id`.

Update/delete master wajib memastikan master tersebut milik outlet yang dimaksud.

### 8.4 Dashboard

`GET /api/accounting/dashboard`

Mode per outlet:

- dengan `outlet_id`

Mode gabungan:

- tanpa `outlet_id`, atau dengan `scope=all`

Response gabungan harus menyertakan:

- summary total semua outlet;
- breakdown per outlet;
- chart existing Accounting V1;
- chart tambahan omzet dan NET per outlet.

### 8.5 Export

`GET /api/accounting/export`

Mode outlet:

- `outlet_id=<uuid>`

Mode gabungan:

- `scope=all`

Export per outlet mempertahankan 16 kolom existing Accounting V1.

Export gabungan menambah kolom `OUTLET` sebagai kolom pertama agar asal transaksi tetap jelas. Dengan demikian export gabungan memiliki 17 kolom.

## 9. Dashboard

### 9.1 Summary cards

Baik mode gabungan maupun per outlet mempertahankan KPI:

- Omzet
- HPP
- DPP
- PPN
- NET
- Jumlah Transaksi

### 9.2 Chart existing

Pertahankan chart V1:

- Revenue by Classification
- Transactions by Classification
- Revenue by Sub Classification
- Revenue by Category
- Goods vs Services
- Revenue by PIC
- NET by Classification
- Monthly Revenue Trend

### 9.3 Chart tambahan gabungan

Tambahkan minimum:

- Omzet per Outlet
- NET per Outlet

Jika digabung dalam satu chart, dua series harus tetap dapat dibedakan dengan jelas.

### 9.4 Filter

Filter periode tetap berlaku.

Pada mode gabungan, filter berlaku ke seluruh outlet.

Pada mode per outlet, filter selalu dikombinasikan dengan `outlet_id` aktif.

## 10. Transaksi

Struktur transaksi Accounting V1 tetap dipertahankan:

1. TANGGAL
2. KLASIFIKASI
3. SUB KLASIFIKASI
4. NAMA CUSTOMER - PEKERJAAN
5. TRANSAKSI
6. NOMINAL TRANSAKSI
7. HPP
8. NET
9. DPP
10. PPN
11. KATEGORI PRODUK
12. METODE PEMBAYARAN
13. STATUS PAID
14. PENJ. BARANG
15. PENJ. JASA
16. PIC

`outlet_id` adalah metadata transaksi dan tidak perlu menjadi kolom ke-17 pada daftar transaksi per outlet karena context sudah jelas dari selector.

Rumus existing tidak berubah:

- DPP = round(Omzet / 1.11)
- PPN = Omzet - DPP
- NET = DPP - HPP

Auto classification tetap:

1. Customer master outlet aktif
2. PIC master outlet aktif
3. Manual

Customer/PIC dari outlet lain tidak boleh memengaruhi classification transaksi outlet aktif.

## 11. Export Excel

### 11.1 Export per outlet

- Nama file menyertakan outlet dan periode.
- Satu sheet per periode.
- Tetap 16 kolom.
- Format Rupiah, border, header, freeze row, dan layout V1 dipertahankan.

Contoh nama file:

`Accounting_Buduk_2026-10.xlsx`

### 11.2 Export gabungan

- Nama file menunjukkan `Semua_Outlet`.
- Tambahkan `OUTLET` sebagai kolom pertama.
- Summary harus dapat menunjukkan total gabungan.
- Setiap baris transaksi wajib memiliki nama outlet.

Contoh:

`Accounting_Semua_Outlet_2026-10.xlsx`

## 12. Access Control

V2 tetap hanya untuk `superadmin`.

Server-side gate tetap wajib untuk semua endpoint Accounting.

Menyembunyikan menu saja tidak cukup.

Belum ada permission outlet-level atau akses khusus role Accounting pada fase ini.

## 13. Isolasi dari Modul Lain

Accounting Multi-Outlet tetap tidak membaca atau menulis data bisnis pada:

- CRM
- Sales Order
- Inventory
- Work Order
- Project
- Invoice

Dependency tetap hanya auth/session dan shell/navigation PixelApps.

## 14. Migration Strategy

Buat migration baru `PXL-ACC-0002-MIGRATION.sql`.

Migration harus additive dan tidak mengubah file migration PXL-ACC-0001 yang sudah pernah dijalankan di production.

Urutan migration:

1. `BEGIN` transaction.
2. Create `accounting_outlets` jika belum ada.
3. Seed Buduk, Lukluk, Bangli.
4. Add nullable `outlet_id` ke lima tabel Accounting jika belum ada.
5. Jalankan migration guard untuk transaksi, Customer, dan PIC existing tanpa mapping outlet; abort jika ditemukan.
6. Ambil snapshot nama seed `accounting_product_categories` dan `accounting_payment_methods` existing.
7. Drop global unique constraint/index pada `name` untuk empat master.
8. Assign/rebuild seed kategori dan metode pembayaran untuk ketiga outlet secara deterministic.
9. Tambahkan foreign key `outlet_id` ke `accounting_outlets(id)`.
10. Buat unique index `(outlet_id, lower(name))` pada empat master.
11. Tambahkan index transaksi `(outlet_id, transaction_date)` untuk query dashboard/report.
12. Validasi tidak ada row `outlet_id IS NULL` pada tabel yang diwajibkan.
13. Set `outlet_id NOT NULL`.
14. `COMMIT`.

Jika guard gagal, transaction harus rollback tanpa partial schema/data change.

Migration staging wajib dijalankan pada isolated staging database terlebih dahulu.

## 15. Compatibility dan Rollback

### Compatibility

- Formula keuangan tidak berubah.
- Kolom transaksi per outlet tetap 16 kolom.
- Endpoint existing dipertahankan dan diperluas dengan outlet filter/context.
- Accounting V1 menjadi basis V2; tidak dibuat subsystem baru terpisah.

### Rollback aplikasi

Revert commit PXL-ACC-0002 atau nonaktifkan wiring multi-outlet.

### Rollback database

Karena migration mengubah uniqueness dan menambah foreign key/kolom, rollback database harus dilakukan hanya dengan backup yang tersedia dan script rollback khusus.

Jangan drop `accounting_outlets` atau `outlet_id` di production tanpa backup dan approval eksplisit.

## 16. Data Inject Workbook — Fase Terpisah

Setelah PXL-ACC-0002 stabil, lakukan fase import terpisah.

Sumber saat ini:

- Buduk: workbook/report historis tersedia; data terverifikasi mencakup Januari–September 2026.
- Lukluk: workbook terpisah tersedia.
- Bangli: user memiliki data terpisah, tetapi inject dilakukan nanti.

Flow import nantinya:

1. Identifikasi outlet sumber.
2. Identifikasi bulan/sheet.
3. Mapping ke 16 field transaksi.
4. Mapping master outlet masing-masing.
5. Preview jumlah transaksi, total omzet, total HPP, dan anomaly.
6. Hitung ulang DPP/PPN/NET dengan rumus server.
7. User approve preview.
8. Import ke outlet target.
9. Reconcile dashboard/report dengan workbook sumber.

Import tidak termasuk implementasi PXL-ACC-0002.

## 17. UAT Acceptance Criteria

PXL-ACC-0002 dianggap lulus staging jika minimum:

1. Selector menampilkan Semua Outlet, Buduk, Lukluk, Bangli.
2. Mode Semua Outlet tidak menyediakan create/edit/delete transaksi/master.
3. Buduk hanya melihat master Buduk.
4. Lukluk hanya melihat master Lukluk.
5. Bangli hanya melihat master Bangli.
6. Nama master yang sama dapat ada di outlet berbeda.
7. PIC berbeda antar outlet berfungsi benar.
8. Create transaksi di Buduk tersimpan dengan outlet Buduk.
9. Transaksi Buduk tidak muncul saat Lukluk aktif.
10. Edit/delete tidak dapat menembus outlet lain.
11. Auto classification hanya membaca Customer/PIC outlet aktif.
12. Formula DPP/PPN/NET sama dengan V1.
13. Dashboard per outlet hanya menghitung outlet aktif.
14. Dashboard Semua Outlet menjumlahkan ketiga outlet.
15. Breakdown Omzet/NET per outlet benar.
16. Filter periode bekerja pada mode gabungan dan per outlet.
17. Export outlet berisi 16 kolom dan hanya outlet target.
18. Export gabungan memiliki kolom OUTLET + 16 kolom V1.
19. Semua `/api/accounting/*` tetap Superadmin-only.
20. Tidak ada read/write ke CRM/SO/Inventory/WO/Project/Invoice.
21. Regression Accounting V1, Project, Attendance, dan shell navigation tetap PASS.
22. Production tidak disentuh sebelum UAT staging disetujui.

## 18. Testing Strategy

Unit/contract tests minimum:

- outlet validation;
- migration guard untuk existing unmapped data;
- master scoping per outlet;
- duplicate name allowed across outlets;
- duplicate name rejected dalam outlet yang sama;
- transaction outlet isolation;
- classification lookup outlet-aware;
- combined dashboard aggregation;
- per-outlet dashboard aggregation;
- export 16-column per outlet;
- export 17-column combined;
- auth gate regression;
- migration contract checks.

Static checks tetap mencakup seluruh file Accounting dan wiring yang disentuh.

## 19. Deployment Strategy

1. Implement pada branch `feature/accounting-multi-outlet-v2`.
2. Sync branch dengan `main` terbaru sebelum UAT.
3. Jalankan regression lengkap.
4. Backup isolated staging DB.
5. Jalankan `PXL-ACC-0002-MIGRATION.sql` hanya staging.
6. Deploy branch ke staging runtime terisolasi.
7. UAT sesuai checklist.
8. Setelah user approve UAT, merge ke `main`.
9. Backup production database + source.
10. Migration production.
11. Deploy VPS production.
12. Smoke test.

## 20. Non-Goals dan Guardrails

- Jangan inject workbook dalam PXL-ACC-0002.
- Jangan mengubah formula Accounting V1.
- Jangan membuat tabel transaksi per outlet.
- Jangan membuat database per outlet.
- Jangan menyatukan master lintas outlet.
- Jangan memberi akses non-Superadmin pada fase ini.
- Jangan menyentuh production sebelum UAT staging dan approval eksplisit.
