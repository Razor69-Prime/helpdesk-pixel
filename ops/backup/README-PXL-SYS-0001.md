# PXL-SYS-0001 — Cloudinary Backup

Tujuan: membuat backup foto Cloudinary ke VPS secara periodik, terstruktur per WO/SO, plus PDF arsip report.

## Struktur backup

```
/home/deploy/pixelapps-backups/cloudinary/
├── objects/                        # cache 1x download per URL
├── weekly/
│   └── YYYY-Www/
│       ├── SO/<SO>/WO/<WO>/
│       │   ├── photos/
│       │   ├── report/<WO>-REPORT.pdf
│       │   ├── work-order.json
│       │   └── sales-order.json
│       ├── WO/<WO>/                # untuk WO tanpa SO
│       └── SERVICE/<SERVICE_NO>/
├── monthly/
│   └── YYYY-MM/...
└── manifests/
```

Hardlink digunakan dari `objects/` ke folder weekly/monthly bila filesystem mendukung, sehingga foto yang sama tidak didownload dua kali dan tidak menggandakan pemakaian disk aktual.

## Mode

- Weekly: `node ops/backup/cloudinary-backup.js --period weekly`
- Monthly: `node ops/backup/cloudinary-backup.js --period monthly`
- Historical backfill: `node ops/backup/cloudinary-backup.js --period monthly --backfill`
- Dry run: tambahkan `--dry-run`
- Test tanggal tertentu: `--anchor YYYY-MM-DD`

## PDF

PDF arsip dibuat server-side dengan PDFKit dan berisi data inti WO/Service, deskripsi/remarks, tanda tangan bila tersedia, dan dokumentasi foto yang berhasil dibackup. Ini adalah PDF arsip backup server-side; PDF UI browser tetap tidak diubah.

## Schedule

- Mingguan: Minggu 03:15 WITA
- Bulanan: tanggal 1 pukul 03:45 WITA

Database/source backup existing tetap berjalan terpisah.

## System Tools

Kartu Backup Status menampilkan:
- status Cloudinary backup
- waktu backup terakhir
- mode weekly/monthly
- jumlah file pada manifest terakhir
- jumlah objek cache + total ukuran
- jumlah error

Tidak ada perubahan schema database.
