'use strict';

const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');

const WEEKLY_KEEP=8;
const MONTHLY_RETENTION_MONTHS=6;
const REMINDER_DAYS=14;
const ARCHIVE_GRACE_HOURS=24;

function keepNewestPeriods(periods,keep){
  return [...new Set((periods||[]).map(String).filter(Boolean))].sort().reverse().slice(0,Math.max(0,Number(keep)||0));
}
function parseMonth(period){
  const m=String(period||'').match(/^(\d{4})-(\d{2})$/);
  if(!m)return null;
  const y=Number(m[1]),mo=Number(m[2]);
  if(mo<1||mo>12)return null;
  return {y,mo};
}
function validPeriod(mode,period){
  return mode==='monthly'?/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period||'')):/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(String(period||''));
}
function monthlyExpiry(period){
  const p=parseMonth(period);if(!p)return null;
  const d=new Date(Date.UTC(p.y,p.mo-1,1));
  d.setUTCMonth(d.getUTCMonth()+MONTHLY_RETENTION_MONTHS+1);
  return d.toISOString().slice(0,10);
}
function daysUntil(targetDate,todayDate){
  const a=new Date(String(todayDate||new Date().toISOString().slice(0,10))+'T00:00:00Z');
  const b=new Date(String(targetDate)+'T00:00:00Z');
  if(!Number.isFinite(a.getTime())||!Number.isFinite(b.getTime()))return null;
  return Math.ceil((b-a)/86400000);
}
function shouldRemind(entry,today){
  if(!entry||entry.downloaded)return false;
  const exp=monthlyExpiry(entry.period);if(!exp)return false;
  const d=daysUntil(exp,today);
  return d!==null&&d>=0&&d<=REMINDER_DAYS;
}
function shouldPurgeMonthly(entry,today){
  if(!entry||!entry.downloaded)return false;
  const exp=monthlyExpiry(entry.period);if(!exp)return false;
  const d=daysUntil(exp,today);
  return d!==null&&d<=0;
}
function listPeriods(root,mode){
  const dir=path.join(root,mode);
  try{return fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isDirectory()&&validPeriod(mode,x.name)).map(x=>x.name).sort().reverse()}catch(_){return []}
}
function receiptsPath(root){return path.join(root,'download-receipts.json')}
function readReceipts(root){
  try{const x=JSON.parse(fs.readFileSync(receiptsPath(root),'utf8'));return x&&typeof x==='object'?x:{}}catch(_){return {}}
}
function writeReceipts(root,data){
  fs.mkdirSync(root,{recursive:true});
  const file=receiptsPath(root),tmp=file+'.tmp-'+process.pid;
  fs.writeFileSync(tmp,JSON.stringify(data,null,2),{mode:0o600});
  fs.renameSync(tmp,file);
}
function markDownloaded(root,period,meta={}){
  if(!validPeriod('monthly',period))throw new Error('Period monthly tidak valid');
  const all=readReceipts(root);
  all[period]={downloaded_at:new Date().toISOString(),downloaded_by:meta.downloaded_by||null,bytes:Number(meta.bytes||0),archive_name:meta.archive_name||null};
  writeReceipts(root,all);
  return all[period];
}
function archivePath(root,period){return path.join(root,'archives','monthly','cloudinary-monthly-'+period+'.tar.gz')}
function monthlyStatus(root,today=new Date().toISOString().slice(0,10)){
  const receipts=readReceipts(root);
  return listPeriods(root,'monthly').map(period=>{
    const receipt=receipts[period]||null;
    const expiry=monthlyExpiry(period);
    const days_left=daysUntil(expiry,today);
    const archive=archivePath(root,period);
    let archive_bytes=0;try{archive_bytes=fs.statSync(archive).size}catch(_){}
    const row={period,expiry_date:expiry,days_left,downloaded:!!receipt,downloaded_at:receipt?.downloaded_at||null,downloaded_by:receipt?.downloaded_by||null,archive_ready:archive_bytes>0,archive_bytes};
    row.reminder=shouldRemind(row,today);
    row.expired=row.days_left!==null&&row.days_left<=0;
    row.purge_blocked=row.expired&&!row.downloaded;
    return row;
  });
}
function removeTree(p){if(fs.existsSync(p))fs.rmSync(p,{recursive:true,force:true})}
function purgeWeekly(root,keep=WEEKLY_KEEP){
  const periods=listPeriods(root,'weekly');
  const keepSet=new Set(keepNewestPeriods(periods,keep));
  const removed=[];
  for(const p of periods){if(!keepSet.has(p)){removeTree(path.join(root,'weekly',p));removed.push(p)}}
  return removed;
}
function purgeMonthly(root,today=new Date().toISOString().slice(0,10)){
  const rows=monthlyStatus(root,today),periods=rows.map(x=>x.period);
  const removed=[];
  for(const row of rows){
    const hasNewer=periods.some(p=>p>row.period);
    if(shouldPurgeMonthly(row,today)&&hasNewer){
      removeTree(path.join(root,'monthly',row.period));
      const a=archivePath(root,row.period);if(fs.existsSync(a))fs.rmSync(a,{force:true});
      removed.push(row.period);
    }
  }
  return removed;
}
function gcObjects(root){
  const dir=path.join(root,'objects');let removed=0,bytes=0;
  let names=[];try{names=fs.readdirSync(dir)}catch(_){return {removed,bytes}}
  for(const name of names){const p=path.join(dir,name);try{const st=fs.statSync(p);if(st.isFile()&&st.nlink<=1){bytes+=st.size;fs.rmSync(p,{force:true});removed++}}catch(_){}}
  return {removed,bytes};
}
function archiveCommand(root,period){
  if(!validPeriod('monthly',period))throw new Error('Period monthly tidak valid');
  const source=path.join(root,'monthly',period);
  if(!fs.existsSync(source))throw new Error('Folder monthly tidak ditemukan: '+period);
  const archive=archivePath(root,period),dir=path.dirname(archive);fs.mkdirSync(dir,{recursive:true});
  const tmp=archive+'.part-'+process.pid;
  return {archive,tmp,cmd:'/usr/bin/tar',args:['-I','gzip -1','-cf',tmp,'-C',path.join(root,'monthly'),period]};
}
function prepareArchive(root,period){
  const target=archivePath(root,period);
  try{if(fs.statSync(target).size>0)return target}catch(_){}
  const c=archiveCommand(root,period);
  const r=spawnSync(c.cmd,c.args,{stdio:'ignore'});
  if(r.status!==0){try{fs.rmSync(c.tmp,{force:true})}catch(_){};throw new Error('Gagal membuat archive monthly '+period)}
  if(!fs.statSync(c.tmp).size){fs.rmSync(c.tmp,{force:true});throw new Error('Archive kosong '+period)}
  fs.renameSync(c.tmp,c.archive);return c.archive;
}
function prepareReminderArchives(root,today=new Date().toISOString().slice(0,10)){
  const prepared=[];
  for(const row of monthlyStatus(root,today)){if(row.reminder&&!row.archive_ready){prepareArchive(root,row.period);prepared.push(row.period)}}
  return prepared;
}
function cleanupDownloadedArchives(root,now=new Date()){
  const receipts=readReceipts(root);const removed=[];
  for(const [period,r] of Object.entries(receipts)){
    const at=new Date(r?.downloaded_at||0);if(!Number.isFinite(at.getTime()))continue;
    if((now-at)/3600000<ARCHIVE_GRACE_HOURS)continue;
    const a=archivePath(root,period);if(fs.existsSync(a)){fs.rmSync(a,{force:true});removed.push(period)}
  }
  return removed;
}
function reminder(root,today=new Date().toISOString().slice(0,10)){
  const rows=monthlyStatus(root,today).filter(x=>x.reminder).sort((a,b)=>a.days_left-b.days_left||a.period.localeCompare(b.period));
  return {active:rows.length>0,count:rows.length,item:rows[0]||null,items:rows};
}

module.exports={
  WEEKLY_KEEP,MONTHLY_RETENTION_MONTHS,REMINDER_DAYS,ARCHIVE_GRACE_HOURS,
  keepNewestPeriods,monthlyExpiry,daysUntil,shouldRemind,shouldPurgeMonthly,validPeriod,
  listPeriods,readReceipts,markDownloaded,archivePath,monthlyStatus,purgeWeekly,purgeMonthly,
  gcObjects,archiveCommand,prepareArchive,prepareReminderArchives,cleanupDownloadedArchives,reminder
};
