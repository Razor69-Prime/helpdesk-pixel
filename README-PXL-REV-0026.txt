PXL-REV-0026 — CUMULATIVE UPDATE

Mencakup:
1. Seluruh perubahan PXL-REV-0025 Material Request.
2. Tanda tangan penyelesaian tiket Teknisi dan Customer.
3. Metode tanda tangan Teknisi: profil akun, gambar langsung, atau upload PNG/JPG.
4. Metode tanda tangan Customer: gambar langsung atau upload PNG/JPG.
5. Tanda tangan Teknisi dan Customer wajib untuk penyelesaian tiket.
6. Operator dan Super Admin dapat bypass kedua tanda tangan dengan alasan wajib.
7. Informasi bypass tercatat di database dan ditampilkan pada PDF tiket.

URUTAN IMPLEMENTASI
1. Jalankan PXL-REV-0026-CUMULATIVE-MR-TICKET-SIGNATURE.sql di Supabase SQL Editor.
2. Replace public/index.html, server.js, dan db.js ke folder project.
3. Jalankan npm start dan tes lokal.
4. Commit dan push ke GitHub.

PENGUJIAN MATERIAL REQUEST
- Pengambilan 10, Pemakaian 7, Pengembalian otomatis 3.
- Cek stok Inventory bertambah 3 dan Log Stok RETURN tercatat.
- Material Prepare boleh kosong.

PENGUJIAN TIKET
- Akun normal: Teknisi dan Customer wajib tanda tangan sebelum tiket selesai.
- Teknisi dapat memakai signature profil, menggambar, atau upload file.
- Customer dapat menggambar atau upload file.
- Operator/Super Admin: centang bypass, isi alasan, lalu selesaikan tiket.
- Export PDF tiket dan pastikan tanda tangan atau keterangan bypass tampil.

Tidak ada dependency baru. Tidak perlu npm install.
