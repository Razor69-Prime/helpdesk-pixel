# PXL-SYS-0001A / PXL-SYS-0001B

## 0001A — Retention Cloudinary Backup
- Weekly: simpan 8 backup mingguan terbaru.
- Monthly: retention 6 bulan.
- Monthly **tidak pernah dihapus jika belum tercatat selesai didownload** ke komputer lokal.
- Object cache dibersihkan hanya bila file tidak lagi memiliki hardlink backup.
- Archive download yang sudah terkirim dibersihkan setelah 24 jam agar tidak menggandakan storage VPS.
- Monthly cron memakai `--completed` agar job tanggal 1 membackup bulan yang baru selesai, bukan bulan baru yang masih kosong.

## 0001B — H-14 Reminder + Download
- Khusus Superadmin.
- H-14 sebelum monthly expire, job low-priority membuat archive `.tar.gz`.
- Proses archive dijalankan dengan `nice -n 19` + `ionice -c3`.
- Header PixelApps menampilkan warning dan tombol **Download Backup Monthly**.
- Download menggunakan token singkat 10 menit; JWT login utama tidak dimasukkan ke URL.
- Setelah server berhasil mengirim file sampai selesai, receipt download dicatat dan reminder hilang.
- Jika download belum dilakukan saat tanggal expire, purge monthly diblokir (SAFETY HOLD).

## Schedule
- Weekly backup: Minggu 03:15 WITA.
- Monthly completed-period backup: tanggal 1 pukul 03:45 WITA.
- Retention/reminder/archive preparation: setiap hari 04:30 WITA, low CPU/IO priority.

## Deploy
Setelah source dideploy, install cron dari `ops/backup/cloudinary-backup.cron`, lalu restart Node karena ada endpoint backend baru.

Tidak ada perubahan schema database.
