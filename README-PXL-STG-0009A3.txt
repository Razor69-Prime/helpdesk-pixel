PXL-STG-0009A3 — Perbaikan db.getLeaveHrOptions

Penyebab:
Paket A2 tidak menyertakan db.js, sementara API Form Cuti memerlukan fungsi
getLeaveHrOptions yang ditambahkan pada db.js A1.

Perbaikan:
- Menyertakan ulang db.js yang memiliki implementasi dan export fungsi HRD.
- Menyertakan API dan frontend Form Cuti versi A2 agar seluruh file sinkron.
- Tidak ada perubahan database dan tidak ada SQL baru.

Sesudah deployment, restart/redeploy server lalu lakukan Ctrl+F5.
