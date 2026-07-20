PXL-REV-0020
Modul: Teknisi - Form Material Request & Inventory Asset

Perubahan:
1. Scan barcode/SKU pada Material Request bekerja berulang seperti kasir retail.
2. Scan kode yang sama menambah Qty pada baris item yang sama, bukan membuat baris baru.
3. Scanner kamera tetap terbuka setelah scan berhasil dan siap membaca item berikutnya.
4. Scanner USB/input manual mengosongkan kolom dan mengembalikan fokus setelah Enter.
5. Quantity tidak dapat melebihi stok Inventory yang tersedia.
6. Kamera tidak menghitung barcode yang terus diam di depan kamera berulang-ulang. Barcode harus dijauhkan sesaat sebelum item yang sama discan kembali.

Cakupan revisi:
- PXL-REV-0020 sudah menggunakan file Inventory dari PXL-REV-0019.
- PXL-REV-0018 juga sudah tercakup melalui PXL-REV-0019.

SQL:
- Tidak ada SQL baru untuk PXL-REV-0020.
- Jika PXL-REV-0019 belum diterapkan, jalankan PXL-REV-0019-inventory-restock-scan-serial.sql.

Cara uji:
1. Jalankan npm start.
2. Login sebagai teknisi/admin yang memiliki akses Material Request.
3. Buka Form Material Request dan pilih nomor WO.
4. Buka Scan Barcode atau fokuskan scanner USB pada input SKU.
5. Scan barcode yang sama 3 kali.
6. Pastikan hanya ada satu baris barang dengan Qty 3.
7. Coba scan hingga melebihi stok dan pastikan sistem menolak penambahan berikutnya.
