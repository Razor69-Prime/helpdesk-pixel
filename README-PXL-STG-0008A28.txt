PXL-STG-0008A28 — Approval Invoice di Modul yang Sama

Scope: staging saja. Tidak ada perubahan main/production dan tidak ada SQL baru.

Alur Invoice:
1. Accounting/Admin/Superadmin membuat atau mengubah Invoice Draft.
2. Pembuat memilih tombol "Ajukan Approval" pada detail Invoice.
3. Status menjadi "Menunggu Persetujuan" dan Draft tidak dapat diedit.
4. Manager/Admin/Superadmin membuka Invoice yang sama dari daftar Invoice,
   lalu memilih "Setujui" atau "Kembalikan untuk Revisi".
5. Setujui mengubah status menjadi "Disetujui" dan menyimpan nama/waktu approver.
6. Accounting/Admin/Superadmin menerbitkan Invoice yang sudah Disetujui.
7. Kembalikan untuk Revisi wajib memakai alasan dan status kembali ke Draft.

Tidak ada menu Approval Invoice baru dan tidak ada notifikasi/menu terpisah.
Approval dilakukan langsung pada detail Invoice, seperti Material Request.

Tambahan PDF:
- Judul proyek memakai project_name dari WO terlebih dahulu.
- Jika WO tidak punya nama project, memakai project_name dari SO.
- Nomor SO/WO tetap menjadi referensi tracking pada PDF.
