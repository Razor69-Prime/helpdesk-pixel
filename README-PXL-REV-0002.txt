PXL-REV-0002 — IMPLEMENTASI MOCKUP INVENTORY ASSET

Modul:
Inventory Asset

Ringkasan:
1. Menambahkan menu Inventory Asset pada navigasi aplikasi.
2. Menambahkan tab Inventory Asset yang memuat mockup original.
3. Akses default tersedia untuk Teknisi, Admin, Manager, dan Super Admin.
4. Menambahkan Inventory Asset ke pilihan Custom Menu akun.
5. Mempertahankan revisi PXL-REV-0001 pada format Total Target Sales.

File yang berubah/ditambahkan:
- public/index.html
- public/inventory.html

SQL:
- Tidak ada. Versi ini menggunakan mockup simulasi original dan belum menyimpan data ke Supabase.

Cara implementasi:
1. Extract ZIP.
2. Salin folder public ke C:\Users\ASUSvivobook\helpdesk-pixel
3. Pilih Replace/Merge saat diminta.
4. Jalankan aplikasi dan login.
5. Buka menu Inventory Asset.

Git:
git add public/index.html public/inventory.html
git commit -m "PXL-REV-0002 feat(inventory): implement original inventory mockup"
git push origin main
