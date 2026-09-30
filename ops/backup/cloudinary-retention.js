#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const {
  WEEKLY_KEEP,MONTHLY_RETENTION_MONTHS,REMINDER_DAYS,
  monthlyStatus,purgeWeekly,purgeMonthly,gcObjects,
  prepareReminderArchives,cleanupDownloadedArchives,reminder
}=require('./cloudinary-retention-lib');

const BACKUP_ROOT=process.env.BACKUP_ROOT||'/home/deploy/pixelapps-backups';
const CLOUD_ROOT=path.join(BACKUP_ROOT,'cloudinary');
const LOG_ROOT=path.join(BACKUP_ROOT,'logs');
const args=process.argv.slice(2);
const arg=(name,def=null)=>{const i=args.indexOf(name);return i>=0&&args[i+1]?args[i+1]:def};
const today=arg('--today',new Date().toISOString().slice(0,10));
const statusOnly=args.includes('--status');
fs.mkdirSync(LOG_ROOT,{recursive:true});
const logFile=path.join(LOG_ROOT,'cloudinary-retention-'+new Date().toISOString().slice(0,10)+'.log');
function log(msg){const line='['+new Date().toISOString()+'] '+msg;console.log(line);fs.appendFileSync(logFile,line+'\n');}

function main(){
  fs.mkdirSync(CLOUD_ROOT,{recursive:true});
  if(statusOnly){
    console.log(JSON.stringify({
      revision:'PXL-SYS-0001A/0001B',
      today,
      weekly_keep:WEEKLY_KEEP,
      monthly_retention_months:MONTHLY_RETENTION_MONTHS,
      reminder_days:REMINDER_DAYS,
      reminder:reminder(CLOUD_ROOT,today),
      monthly:monthlyStatus(CLOUD_ROOT,today)
    },null,2));
    return;
  }
  log('Mulai retention Cloudinary weekly='+WEEKLY_KEEP+' monthly='+MONTHLY_RETENTION_MONTHS+' bulan reminder=H-'+REMINDER_DAYS);
  const prepared=prepareReminderArchives(CLOUD_ROOT,today);
  const removedArchives=cleanupDownloadedArchives(CLOUD_ROOT,new Date(today+'T23:59:59Z'));
  const weeklyRemoved=purgeWeekly(CLOUD_ROOT,WEEKLY_KEEP);
  const monthlyRemoved=purgeMonthly(CLOUD_ROOT,today);
  const gc=gcObjects(CLOUD_ROOT);
  log('Archive reminder disiapkan: '+(prepared.join(',')||'-'));
  log('Archive download lama dibersihkan: '+(removedArchives.join(',')||'-'));
  log('Weekly dihapus: '+(weeklyRemoved.join(',')||'-'));
  log('Monthly dihapus: '+(monthlyRemoved.join(',')||'-'));
  log('Object GC: '+gc.removed+' file / '+gc.bytes+' bytes');
  const blocked=monthlyStatus(CLOUD_ROOT,today).filter(x=>x.purge_blocked);
  if(blocked.length)log('SAFETY HOLD monthly expired tetapi belum didownload: '+blocked.map(x=>x.period).join(','));
  log('Retention selesai');
}
try{main()}catch(e){console.error('[PXL-SYS-0001A/1B] retention gagal:',e);process.exit(1)}
