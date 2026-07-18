PXL-REV-0027
Modul: Penyelesaian Tiket, Material Request, Inventory

Perbaikan:
- Endpoint penyelesaian teknisi tidak lagi menulis ke tabel material_requests yang tidak tersedia.
- Data disimpan ke public.material_request_forms.
- Material dicocokkan berdasarkan nama persis, SKU, barcode, atau Product Number.
- Stok Inventory dikurangi melalui fungsi inventory_issue_material_request.
- Jasa disimpan pada JSON items tanpa mengubah stok.
- GET laporan lama tetap kompatibel dengan data material_request_forms.

Implementasi:
1. Replace public/index.html, server.js, dan db.js.
2. Tidak ada SQL baru.
3. Jalankan npm start dan uji penyelesaian tiket.
4. Material wajib sudah terdaftar di Inventory.
