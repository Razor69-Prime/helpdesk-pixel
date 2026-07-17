PXL-REV-0020 CUMULATIVE PACKAGE
Mencakup: PXL-REV-0018, PXL-REV-0019, dan PXL-REV-0020

RINGKASAN FITUR

PXL-REV-0018 — Scan Barcode Pabrikan saat Tambah Barang
- Tombol Scan Barcode Pabrikan tersedia di form Tambah Barang.
- Barcode yang belum terdaftar dimasukkan ke form item baru.
- Barcode lama diarahkan ke item yang sudah ada/restock.

PXL-REV-0019 — Restock Scan Counter & Serial Tracking
- Barang quantity: scan barcode/SKU/Product Number yang sama menambah qty +1.
- Tersedia input total qty manual.
- Barang serial: setiap Serial Number unik menambah stok +1.
- Serial Number duplikat ditolak.
- Restock, pencatatan serial, dan log stok diproses melalui database.

PXL-REV-0020 — Material Request Retail Scan Counter
- Pada form Material Request teknisi, scan barcode/SKU yang sama menambah qty.
- Item yang sama tetap satu baris.
- Qty dibatasi oleh stok Inventory.
- Scanner kamera, scanner USB, dan input manual tetap didukung.

FILE SOURCE
- public/index.html
- public/inventory.html
- server.js
- db.js

SQL
- PXL-REV-0019-inventory-restock-scan-serial.sql
  SQL ini sudah mencakup kebutuhan database untuk REV-0019 dan REV-0020.
  REV-0018 dan REV-0020 tidak memerlukan SQL tambahan.

URUTAN IMPLEMENTASI
1. Jalankan PXL-REV-0019-inventory-restock-scan-serial.sql di Supabase SQL Editor.
2. Extract ZIP ke C:\Users\ASUSvivobook\helpdesk-pixel.
3. Pilih Replace/Merge.
4. Jalankan npm start untuk tes lokal.
5. Push seluruh file ke GitHub.

GIT
cd C:\Users\ASUSvivobook\helpdesk-pixel

git add public/index.html public/inventory.html server.js db.js PXL-REV-0019-inventory-restock-scan-serial.sql README-PXL-REV-0020-CUMULATIVE.txt VERIFICATION-PXL-REV-0020-CUMULATIVE.txt

git commit -m "PXL-REV-0020 feat(inventory): cumulative barcode restock and material request scan"

git push origin main
