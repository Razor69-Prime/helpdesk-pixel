PXL-STG-0008A29 — Rincian Item & Jasa Sebelum Approval Invoice

Scope: staging saja. Tidak ada SQL baru dan tidak menyentuh main/production.

Perubahan:
- Detail Invoice menampilkan tabel Rincian Item & Jasa sebelum approval.
- Setiap baris memuat nama item/jasa, deskripsi, qty/satuan, harga satuan,
  dan subtotal.
- Menampilkan Total Rincian serta Total Invoice untuk pengecekan approval.
- Manager/Admin/Superadmin memeriksa rincian tersebut pada Invoice yang sama
  sebelum memilih Setujui atau Kembalikan untuk Revisi.

Alur tetap:
Draft → Ajukan Approval → Menunggu Persetujuan → Disetujui → Terbitkan
