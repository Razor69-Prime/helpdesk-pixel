PXL-STG-0009A4 - Perbaikan Form Cuti/Izin

Perubahan:
1. Simpan saldo cuti memakai upsert berdasarkan user_id dan year.
2. Saldo yang sudah ada diperbarui, bukan dibuat sebagai baris duplikat.
3. Generator PDF A5 tidak lagi menampilkan pesan error undefined.
4. Kedua aset logo PDF disertakan ulang dalam paket revisi.
5. Setiap master dropdown Admin HR memiliki tombol hapus.
6. Penghapusan pilihan tidak mengubah nilai yang sudah tersimpan pada form lama.

SQL: tidak ada SQL baru.
Prasyarat: migration PXL-STG-0009A dan PXL-STG-0009A1 sudah dijalankan.
Target: staging. Production tidak disentuh.
