# PXL-STG-0006 — UAT TERPADU

Branch: `staging`

## 0006A — Fondasi
- [ ] Setiap SO memiliki `quotation_number`.
- [ ] Nomor quotation tidak berubah ketika Draft direvisi.
- [ ] `quotation_revision_no` bertambah saat Draft diperbarui.
- [ ] Customer 360 tersimpan saat SO disetujui.

## 0006B — Form Material dan Jasa
- [ ] Draft dapat disimpan hanya dengan Material.
- [ ] Draft dapat disimpan hanya dengan Jasa.
- [ ] Draft dapat disimpan dengan Material dan Jasa.
- [ ] Material wajib dipilih dari Inventory.
- [ ] Jasa dapat diinput manual tanpa Inventory.
- [ ] Subtotal Material, subtotal Jasa, dan Grand Total benar.
- [ ] Edit Draft mengembalikan baris ke kelompok yang benar.

## 0006C — PDF Penawaran
- [ ] Tombol PDF Penawaran muncul pada Draft.
- [ ] Tombol PDF Penawaran muncul pada Approved.
- [ ] PDF mencantumkan nomor quotation, nomor SO, revisi, tanggal, dan expired.
- [ ] A. ITEM DETAILS hanya berisi Material.
- [ ] B. SERVICE DETAILS hanya berisi Jasa.
- [ ] Subtotal dan Grand Total PDF sesuai SO.
- [ ] Tombol Riwayat menampilkan snapshot revisi.

## 0006D — Routing WO dan MR
- [ ] SO Approved dapat membuat WO.
- [ ] Daftar Jasa muncul pada deskripsi/rincian pekerjaan WO teknisi.
- [ ] `service_items` tersimpan pada Ticket dan CRM Work Order.
- [ ] Form Material Request hanya memuat Material.
- [ ] Flow pengambilan, pemakaian, pengembalian, dan gudang Rev 05 tetap berjalan.

## 0006E — Customer 360
- [ ] Approval mencari customer berdasarkan telepon atau nama.
- [ ] Customer baru dibuat bila belum tersedia.
- [ ] SO terhubung ke `customer_id`.
- [ ] Customer 360 menampilkan transaksi terakhir dan lifetime value.
- [ ] Riwayat transaksi menampilkan quotation, SO, Material, Jasa, dan total.
- [ ] Harga terakhir Material/Jasa tampil.
- [ ] Tombol sinkronisasi dapat memperbarui SO Approved lama.

## 0006F — Stabilisasi
- [ ] Hard refresh menampilkan asset Rev 06 terbaru.
- [ ] Endpoint `/api/integration/rev6-status` dapat dibuka oleh akun CRM.
- [ ] Tidak ada perubahan pada branch `main`.
- [ ] Tidak ada perubahan pada database production.
- [ ] Tidak ada error console saat membuka SO, CRM, WO, dan MR.

## Skenario UAT Utama
1. Buat Draft berisi minimal 1 Material dan 1 Jasa.
2. Unduh PDF Penawaran saat Draft.
3. Edit Draft, ubah harga/qty, lalu cek nomor quotation tetap dan revisi bertambah.
4. Unduh PDF revisi dan buka Riwayat.
5. Setujui SO.
6. Buka Customer 360 dan cek transaksi/harga terakhir.
7. Buat WO.
8. Buka WO sebagai teknisi dan cek Daftar Pekerjaan/Jasa.
9. Buat MR dari WO dan pastikan hanya Material yang muncul.
10. Selesaikan pengambilan, pemakaian, pengembalian, dan PDF MR seperti Rev 05.
