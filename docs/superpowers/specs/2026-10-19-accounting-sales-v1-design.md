# Accounting Sales V1 — Design Spec

## Tujuan
Membangun modul standalone `Accounting` di PixelApps untuk pencatatan transaksi penjualan manual dengan tampilan tabel yang semirip mungkin dengan workbook penjualan Pixel Buduk, perhitungan otomatis DPP/PPN/NET, dashboard analisa internal, dan export Excel per periode. Modul V1 hanya dapat diakses oleh Superadmin.

## Prinsip Isolasi
- Accounting adalah subsystem standalone.
- Tidak membaca atau menulis data bisnis dari CRM, Sales Order, Inventory, Work Order, Project, Invoice, atau modul PixelApps lain.
- Dependency ke aplikasi existing hanya autentikasi/session user dan shell/navigation PixelApps.
- Data master Accounting disimpan sendiri: customer, PIC, kategori produk, dan metode pembayaran.
- Rollback/disable Accounting tidak boleh mengubah perilaku modul existing.

## Akses
- Role efektif V1: `superadmin` saja.
- Menu Accounting tidak ditampilkan ke role lain.
- Semua endpoint `/api/accounting/*` wajib melakukan server-side gate Superadmin; menyembunyikan menu saja tidak dianggap cukup.
- Di Manajemen Akun disiapkan checklist `📊 Accounting — Laporan Transaksi` dengan id `accounting_transaction_report` sebagai permission placeholder/future-read-only access.
- Pada V1 checklist tersebut tidak membuka akses untuk role selain Superadmin. UI harus menjelaskan bahwa Accounting V1 tetap khusus Superadmin.

## Struktur Menu
`Accounting`
- `Dashboard`
- `Transaksi Penjualan`
- `Master Accounting`
  - Customer
  - PIC
  - Kategori Produk
  - Metode Pembayaran

Dashboard dan Transaksi Penjualan berada di dalam module Accounting, bukan Dashboard utama PixelApps.

## Transaksi Penjualan
### Urutan kolom wajib
Urutan, nama, dan posisi kolom tidak boleh diubah:

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

### Visual
- Tabel harus mengikuti gaya workbook sumber sedekat mungkin: bar nama bulan, header oranye/cokelat, teks header putih, grid/border tegas, background data putih, layout dense seperti spreadsheet, format Rupiah, dan kolom tetap dalam urutan sumber.
- UI PixelApps modern boleh digunakan untuk toolbar/filter/modal, tetapi area data transaksi tidak boleh diubah menjadi card-based table yang menghilangkan karakter spreadsheet sumber.
- Export Excel harus mempertahankan urutan kolom, heading, format Rupiah, border, warna header, nama bulan, dan layout sedekat mungkin dengan workbook sumber.

### Input Accounting
Accounting mengisi data transaksi dan dua angka sumber saja:
- `NOMINAL TRANSAKSI / OMZET` — manual.
- `HPP` — manual.

Field `NET`, `DPP`, dan `PPN` bersifat read-only dan dihitung server-side serta ditampilkan otomatis di UI.

Rumus V1:
- `DPP = NOMINAL_TRANSAKSI / 1.11`
- `PPN = NOMINAL_TRANSAKSI - DPP`
- `NET = DPP - HPP`

Pembulatan memakai Rupiah integer yang konsisten dengan workbook sumber. Jika nominal atau HPP diubah, DPP/PPN/NET dihitung ulang dan agregat dashboard ikut berubah.

### Klasifikasi
`KLASIFIKASI`:
- B2C
- B2B
- B2G
- B2BG

`SUB KLASIFIKASI`:
- Perdagangan
- Project
- Operasional

Auto-classification berdiri sendiri di Accounting:
1. Master Customer Accounting `default_classification`.
2. Jika customer tidak memiliki default, gunakan Master PIC Accounting `default_classification`.
3. Jika tidak ada keduanya, user memilih manual.
4. User Superadmin tetap boleh override hasil saran sebelum simpan.

Tidak ada lookup ke CRM Customer Profile atau user Sales PIC existing.

### Penjualan Barang/Jasa
- `PENJ. BARANG` dan `PENJ. JASA` tetap dua kolom terpisah.
- Nilai disimpan sebagai bagian transaksi Accounting dan tidak memengaruhi Inventory atau modul operasional lain.
- Implementasi V1 harus menyediakan input/derivasi lokal tanpa dependency ke master item Inventory.

### Status Paid
- Header tetap `STATUS PAID`.
- Nilai V1: `PAID` atau `UNPAID`.
- Status ini hanya metadata Accounting dan tidak terhubung ke Invoice/AR module lain.

## Master Accounting
Master lokal minimal:
- `accounting_customers`: nama customer, default classification, aktif/nonaktif.
- `accounting_pics`: nama PIC, default classification, aktif/nonaktif.
- `accounting_product_categories`: nama kategori, aktif/nonaktif.
- `accounting_payment_methods`: nama metode, aktif/nonaktif.

Master Accounting tidak menggunakan foreign key bisnis ke tabel modul lain.

## Dashboard Accounting
Dashboard berada di dalam module Accounting dan membaca hanya tabel Accounting.

Filter minimal:
- periode bulan/tahun,
- klasifikasi,
- sub klasifikasi,
- PIC,
- kategori produk.

Summary minimal:
- Omzet,
- HPP,
- DPP,
- PPN,
- NET,
- jumlah transaksi.

Grafik minimal:
- Omzet per Klasifikasi (B2C/B2B/B2G/B2BG),
- Jumlah transaksi per Klasifikasi,
- Omzet per Sub Klasifikasi,
- Omzet per Kategori Produk,
- Penjualan Barang vs Jasa,
- Omzet per PIC,
- NET per Klasifikasi,
- trend omzet bulanan.

Grafik harus otomatis berubah ketika transaksi dibuat/diubah/dihapus karena agregasi dihitung dari data transaksi Accounting, bukan disimpan manual.

## Periode dan Export Excel
- Periode ditentukan dari `transaction_date`, bukan `created_at`.
- Export dapat memilih satu atau beberapa bulan.
- Satu bulan menghasilkan satu sheet bernama bulan (contoh `OKTOBER`).
- Multi-bulan menghasilkan sheet terpisah sesuai periode yang dipilih.
- Export hanya membaca Accounting transaction data.

## Data Model Utama
Tabel transaksi lokal: `accounting_sales_transactions`.

Field konseptual:
- id
- transaction_date
- classification
- sub_classification
- customer_name
- job_name
- transaction_description
- gross_amount
- hpp_amount
- net_amount
- dpp_amount
- ppn_amount
- product_category
- payment_method
- paid_status
- goods_amount
- service_amount
- pic_name
- classification_source
- created_by
- created_at
- updated_by
- updated_at

Database boleh menormalisasi master lokal, tetapi API/export wajib mengembalikan snapshot transaksi sehingga perubahan nama master di masa depan tidak mengubah laporan historis.

## API Boundary
Semua route menggunakan prefix `/api/accounting/` dan server-side Superadmin gate.

Kelompok endpoint:
- transactions: list/create/update/delete/detail,
- dashboard/summary,
- masters customer/PIC/category/payment,
- export Excel.

Tidak ada endpoint Accounting yang melakukan write ke tabel non-Accounting.

## Validasi
- nominal transaksi >= 0,
- HPP >= 0,
- tanggal transaksi wajib,
- klasifikasi harus salah satu enum V1,
- sub klasifikasi harus salah satu enum V1,
- paid status hanya PAID/UNPAID,
- perhitungan DPP/PPN/NET selalu dilakukan server-side; angka kalkulasi dari client diabaikan.

## Audit dan Historis
- Simpan `created_by`, `created_at`, `updated_by`, `updated_at`.
- Nama customer/PIC/kategori/metode pada transaksi disimpan sebagai snapshot untuk menjaga laporan historis.
- Delete transaksi harus terbatas Superadmin dan implementasi harus menjaga jejak audit minimal sesuai pola existing PixelApps (soft-delete bila pola DB existing memungkinkan; jika tidak, history/audit record terpisah).

## Non-Goals V1
- Tidak sinkron dengan Sales Order.
- Tidak sinkron dengan CRM.
- Tidak sinkron dengan Inventory/HPP master.
- Tidak membuat invoice.
- Tidak mengubah stok.
- Tidak mengubah omzet/KPI dashboard PixelApps global.
- Tidak membuka Accounting ke Manager, Accounting role, HR, Admin, Sales, atau Teknisi.

## Acceptance Criteria
1. Hanya Superadmin melihat dan membuka Accounting.
2. Non-Superadmin mendapat 403 dari seluruh `/api/accounting/*` walau memanggil endpoint langsung.
3. Transaksi tampil dengan 16 kolom dan urutan persis seperti spec.
4. User memasukkan Omzet + HPP; DPP/PPN/NET otomatis dan konsisten setelah create/update.
5. Master/customer/PIC classification bekerja tanpa CRM atau modul lain.
6. Dashboard Accounting menampilkan summary dan grafik dari data Accounting saja.
7. Export Excel per bulan/multi-bulan mempertahankan layout/urutan/warna spreadsheet sedekat mungkin dengan sample.
8. Tidak ada write/read bisnis dari Accounting ke tabel CRM, SO, Inventory, WO, Project, atau Invoice.
9. Checklist `Accounting — Laporan Transaksi` tersedia di Manajemen Akun sebagai placeholder, tetapi V1 tetap Superadmin-only.
10. Seluruh perubahan berada di branch `feature/accounting-sales-v1` sampai UAT disetujui; `main` dan VPS production tidak disentuh selama implementasi awal.
