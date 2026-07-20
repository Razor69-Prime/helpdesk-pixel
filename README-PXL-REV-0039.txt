PXL-REV-0039
Modul: CRM Deployment Fix
Baseline: PXL-REV-0037

Perbaikan:
- Paket kumulatif, bukan hanya patch index.html.
- CRM dipaksa masuk ke hasil buildNav meskipun custom_menus akun lama belum memuat crm.
- Menambahkan fallback CRM statis di sidebar.
- Menambahkan checklist CRM fallback di Manajemen Akun.
- Super Admin mendapat semua checklist dan checklist dikunci aktif.
- Menghapus registrasi service worker lama agar cache PWA tidak menahan index lama.
- Menambahkan revision-check.html untuk membuktikan versi deployment.
- Menambahkan Cache-Control no-store untuk index, CRM, dan halaman pemeriksaan.

Pemeriksaan setelah deploy:
1. Buka /revision-check.html?v=0039
2. Harus tampil PXL-REV-0039 AKTIF
3. Buka aplikasi, logout/login
4. Sidebar menampilkan PXL-REV-0039 • CRM ACTIVE
5. CRM & Sales Order tampil di Sales & Proyek

SQL:
- Gunakan PXL-REV-0037-MIGRATION.sql yang disertakan dalam paket.
