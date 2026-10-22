PXL-ACC-0002 — Accounting Multi-Outlet V2
==========================================

Scope
-----
- Outlet: Buduk, Lukluk, Bangli.
- Dashboard/report: mode Semua Outlet dan per outlet.
- Transaksi dan master: wajib per outlet.
- Master outlet-specific: Customer, PIC, Kategori Produk, Metode Pembayaran.
- Export: 16 kolom per outlet, 17 kolom gabungan dengan kolom OUTLET.
- Access: Superadmin only.
- Workbook injection/import: TIDAK termasuk revisi ini.

UAT Checklist
-------------
[x] Tiga outlet aktif ter-seed: Buduk, Lukluk, Bangli.
[ ] Selector UI menampilkan Semua Outlet, Buduk, Lukluk, Bangli.
[ ] Semua Outlet hanya read/report/export; tidak ada create/edit/delete transaksi/master.
[x] Master Buduk tidak muncul di Lukluk/Bangli dan sebaliknya.
[x] Nama master yang sama boleh dipakai di outlet berbeda.
[x] PIC dengan nama sama di dua outlet tidak digabung tanpa identitas outlet pada report gabungan.
[x] Create transaksi menyimpan outlet_id outlet aktif.
[x] Edit/delete transaksi lintas outlet ditolak.
[x] DPP = round(Omzet/1.11), PPN = Omzet-DPP, NET = DPP-HPP tetap sama.
[x] Dashboard gabungan sama dengan total dashboard per outlet untuk data fixture yang sama.
[x] Chart Omzet per Outlet dan NET per Outlet tampil pada scope gabungan.
[x] Export per outlet tetap 16 kolom A:P dan tidak membawa row outlet lain.
[x] Export gabungan 17 kolom A:Q dengan OUTLET di kolom A.
[x] Unauthenticated /api/accounting/* tetap 401.
[x] Non-Superadmin tetap 403 berdasarkan regression/authorized UAT yang tersedia.
[x] Modul CRM, Sales Order, Inventory, Work Order, Project, Invoice tidak berubah oleh revisi ini.
[x] Tidak ada workbook historis yang di-inject pada PXL-ACC-0002.

Deployment Gate
---------------
- Migration wajib diuji pada clone PostgreSQL staging terisolasi.
- Production tidak boleh dimigrate/deploy sebelum UAT staging selesai dan user memberi approval production eksplisit.
- Sebelum production migration wajib backup source dan PostgreSQL database.

UAT Evidence
------------
Status: STAGING UAT PASS (technical/business flow) — visual authenticated browser UAT not run because no authorized staging Superadmin login was available; authentication was not bypassed for visual testing.

Evidence 21 Oktober 2026:
- Fresh read-only production snapshot restored to isolated PostgreSQL 17 staging; production Accounting remained unchanged during UAT.
- PXL-ACC-0002 migration PASS: 3 outlets, 5 intended outlet_id columns, category seeds 12 (4 x 3), payment seeds 9 (3 x 3).
- Migration rerun/idempotency PASS after UAT data existed; no duplicate outlet master rows were created.
- Duplicate PIC name (case-insensitive) rejected within Buduk, same PIC name accepted across Buduk and Lukluk.
- Cross-outlet update predicate returned 0 rows; same-outlet update returned 1 row.
- Formula fixture PASS: gross 1,110,000; HPP 500,000; DPP 1,000,000; PPN 110,000; NET 500,000.
- Combined fixture PASS: gross 3,330,000; NET 1,700,000; 2 transactions; total equals Buduk + Lukluk.
- Combined dashboard retains configured outlets with zero transactions (for example Bangli = 0) so all three outlets remain visible.
- Export PASS: per-outlet A:P (16 columns), combined A:Q (17 columns) with OUTLET identity.
- Delete/audit fixture PASS: soft-delete state verified and DELETE audit row present.
- Production unauthenticated Accounting smoke: HTTP 401 {"error":"Unauthorized"}; no credentials used.
- Superadmin/non-Superadmin route gate remains covered by existing Accounting V1 regression; no staging credentials were manufactured.
- Static UI contract PASS for selector, combined read-only controls, outlet-scoped API requests, and outlet comparison charts.
- Workbook historical inject intentionally not performed.
