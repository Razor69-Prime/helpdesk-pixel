const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'../..');

const ui=fs.readFileSync(path.join(root,'public/pxl-urg-0076-system-tools.js'),'utf8');
const reminder=fs.readFileSync(path.join(root,'public/pxl-sys-0001b-cloudinary-reminder.js'),'utf8');
const cron=fs.readFileSync(path.join(root,'ops/backup/cloudinary-backup.cron'),'utf8');
const retention=fs.readFileSync(path.join(root,'ops/backup/cloudinary-retention.js'),'utf8');
const archive=fs.readFileSync(path.join(root,'ops/backup/cloudinary-monthly-archive.js'),'utf8');

assert(!ui.includes("x.archive_ready&&!x.downloaded"),'Tombol masih disembunyikan setelah download');
assert(ui.includes("x.archive_ready?"),'Tombol download belum berbasis archive_ready saja');
assert(cron.includes('cloudinary-monthly-archive.js'),'Auto archive monthly belum dijadwalkan');
assert(cron.includes('nice -n 19')&&cron.includes('ionice -c3'),'Auto archive belum low-priority');
assert(archive.includes('previousWitaMonth'),'Auto archive belum menarget bulan yang sudah selesai');
assert(archive.includes('--all-completed'),'Backfill archive completed periods belum tersedia');
assert(!retention.includes('cleanupDownloadedArchives(CLOUD_ROOT'),'Archive masih dihapus 24 jam setelah download');
assert(reminder.includes("if(!d?.active||!d.item){remove();return}"),'Reminder H-14 harus tetap murni dari status reminder');
console.log('PASS PXL-SYS-0001B1');
