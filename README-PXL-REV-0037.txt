PXL-REV-0037
Baseline: PXL-REV-0035 + patch PXL-REV-0036

Modul:
- Fix menu CRM & Sales Order dan checklist akses.
- Super Admin selalu melihat semua menu.
- Default Sales mendapatkan menu CRM.
- Safe customer import melalui staging.
- Normalisasi nomor WhatsApp.
- Hyperlink WhatsApp dengan template otomatis.
- History komunikasi dan follow-up berikutnya.

File penting:
- PXL-REV-0037-MIGRATION.sql
- PXL-REV-0037-CUSTOMER-IMPORT-TEMPLATE.sql
- public/index.html
- public/crm.html
- server.js
- db.js

Urutan:
1. Jalankan PXL-REV-0037-MIGRATION.sql di Supabase.
2. Timpa seluruh file ZIP ke root project.
3. npm install
4. Commit dan push.
5. Setelah deploy lakukan hard refresh Ctrl+F5, logout, lalu login kembali.

Catatan WhatsApp:
- Klik WA mencatat bahwa WhatsApp dibuka.
- Tanpa WhatsApp Business API, sistem tidak dapat memastikan pesan terkirim/dibaca.
