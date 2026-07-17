PXL-REV-0008
Modul: Inventory API Routing

Perubahan:
- Memindahkan seluruh route /api/inventory sebelum route catch-all app.get('*').
- Endpoint /api/inventory/health kini mengembalikan JSON, bukan halaman dashboard.
- Tidak ada perubahan database atau UI.

File berubah:
- server.js

Pengujian:
1. Deploy ke Vercel.
2. Login ke aplikasi.
3. Buka /api/inventory/health.
4. Hasil harus berupa JSON.
