PXL-STG-0009A16 — Sinkronisasi Saldo Cuti dan Perbaikan Tombol Modal

Perubahan:
1. Status approved/disetujui dinormalisasi saat menghitung pemakaian cuti.
2. Jenis Cuti, Cuti Tahunan, dan annual_leave mengurangi saldo tahunan.
3. History, report form, detail, dan PDF menggunakan snapshot saldo terbaru.
4. Tombol Tutup/Batal tidak lagi memakai `$()` atau bergantung pada jQuery.
5. Service worker tidak lagi memanggil clients.claim(); cache dinaikkan ke v58.

Tidak membutuhkan SQL. Production tidak disentuh.
