#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {pipeline}=require('stream/promises');
const fetch=require('node-fetch');
const PDFDocument=require('pdfkit');
const db=require('../../db');
const {periodKey,safeName,recordDate,inPeriod,woRelativePath,serviceRelativePath}=require('./cloudinary-backup-lib');

const APP_ROOT=path.resolve(__dirname,'../..');
const BACKUP_ROOT=process.env.BACKUP_ROOT||'/home/deploy/pixelapps-backups';
const CLOUD_ROOT=path.join(BACKUP_ROOT,'cloudinary');
const OBJECT_ROOT=path.join(CLOUD_ROOT,'objects');
const LOG_ROOT=path.join(BACKUP_ROOT,'logs');
const args=process.argv.slice(2);
const arg=(name,def=null)=>{const i=args.indexOf(name);return i>=0&&args[i+1]?args[i+1]:def};
const mode=arg('--period','weekly');
const backfill=args.includes('--backfill');
const dryRun=args.includes('--dry-run');
const completed=args.includes('--completed');
const anchorRaw=arg('--anchor',null);
function completedMonthlyAnchor(now=new Date()){
  const wita=new Date(now.getTime()+8*3600000);
  return new Date(Date.UTC(wita.getUTCFullYear(),wita.getUTCMonth(),0,12,0,0));
}
const anchor=anchorRaw?new Date(anchorRaw+'T12:00:00Z'):(mode==='monthly'&&completed?completedMonthlyAnchor():new Date());
if(!['weekly','monthly'].includes(mode))throw new Error('--period harus weekly atau monthly');
if(Number.isNaN(anchor.getTime()))throw new Error('--anchor tidak valid');

fs.mkdirSync(OBJECT_ROOT,{recursive:true});
fs.mkdirSync(LOG_ROOT,{recursive:true});
const runStamp=new Date().toISOString().replace(/[:.]/g,'-');
const logFile=path.join(LOG_ROOT,'cloudinary-backup-'+new Date().toISOString().slice(0,10)+'.log');
function log(msg){const line='['+new Date().toISOString()+'] '+msg;console.log(line);fs.appendFileSync(logFile,line+'\n');}

function pickUrl(photo){return String(photo?.secure_url||photo?.image_url||'').trim();}
function extFrom(photo,url,contentType=''){
  const candidates=[photo?.original_filename,photo?.generated_filename,new URL(url).pathname];
  for(const x of candidates){const e=path.extname(String(x||'')).toLowerCase();if(/^\.(jpe?g|png|webp|gif|pdf)$/.test(e))return e==='.jpeg'?'.jpg':e;}
  if(/png/i.test(contentType))return '.png';
  if(/webp/i.test(contentType))return '.webp';
  if(/gif/i.test(contentType))return '.gif';
  return '.jpg';
}
function objectBase(url){return crypto.createHash('sha256').update(url).digest('hex');}
async function downloadToCache(photo){
  const url=pickUrl(photo);if(!url)throw new Error('photo URL kosong');
  const prefix=objectBase(url);
  const existing=fs.readdirSync(OBJECT_ROOT).find(n=>n.startsWith(prefix+'.'));
  if(existing){const p=path.join(OBJECT_ROOT,existing);if(fs.statSync(p).size>0)return p;}
  const res=await fetch(url,{timeout:45000});
  if(!res.ok)throw new Error('HTTP '+res.status+' '+url);
  const ext=extFrom(photo,url,res.headers.get('content-type')||'');
  const target=path.join(OBJECT_ROOT,prefix+ext);
  const tmp=target+'.part-'+process.pid;
  await pipeline(res.body,fs.createWriteStream(tmp,{mode:0o600}));
  if(!fs.statSync(tmp).size){fs.unlinkSync(tmp);throw new Error('download kosong '+url);}
  fs.renameSync(tmp,target);
  return target;
}
function linkOrCopy(src,dst){
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  if(fs.existsSync(dst)&&fs.statSync(dst).size>0)return;
  try{fs.linkSync(src,dst);}catch(_){fs.copyFileSync(src,dst);}
}
function photoOutputName(photo,index,cachePath){
  const raw=photo.original_filename||photo.generated_filename||path.basename(String(photo.cloudinary_public_id||''))||('photo-'+String(index+1).padStart(3,'0'));
  const base=safeName(path.basename(raw,path.extname(raw)));
  return String(index+1).padStart(3,'0')+'-'+base+path.extname(cachePath);
}
function dataUrlBuffer(v){try{const m=String(v||'').match(/^data:image\/(?:png|jpeg|jpg);base64,(.+)$/i);return m?Buffer.from(m[1],'base64'):null}catch(_){return null}}

function writeWoPdf(file,ticket,photoFiles){
  return new Promise((resolve,reject)=>{
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const out=fs.createWriteStream(file,{mode:0o600});
    const doc=new PDFDocument({size:'A4',margin:36});
    out.on('finish',resolve);out.on('error',reject);doc.on('error',reject);doc.pipe(out);
    const fmt=v=>v?new Date(v).toLocaleString('id-ID',{timeZone:'Asia/Makassar'}):'-';
    doc.font('Helvetica-Bold').fontSize(17).text('PIXEL SOLUSINDO');
    doc.fontSize(14).text('ARSIP LAPORAN WORK ORDER',{align:'right'});
    doc.moveDown();
    const rows=[
      ['No. WO',ticket.wo_number||'-'],['No. SO',ticket.so_number||'-'],['Project',ticket.project_name||'-'],
      ['Customer',ticket.customer_name||'-'],['No. WA',ticket.customer_phone||'-'],['Status',ticket.status||'-'],
      ['Tanggal Kerja',fmt(ticket.worked_at||ticket.scheduled_date)],['Teknisi',Array.isArray(ticket.technicians)?ticket.technicians.join(' & '):(ticket.technician||'-')]
    ];
    for(const [k,v] of rows){doc.font('Helvetica-Bold').fontSize(8).text(k+': ',{continued:true});doc.font('Helvetica').text(String(v||'-'));}
    doc.moveDown(.5);doc.font('Helvetica-Bold').text('Deskripsi');doc.font('Helvetica').text(ticket.description||'-');
    if(ticket.technician_remarks){doc.moveDown(.5);doc.font('Helvetica-Bold').text('Remarks Teknisi');doc.font('Helvetica').text(ticket.technician_remarks);}
    const tech=dataUrlBuffer(ticket.tech_signature),cust=dataUrlBuffer(ticket.customer_signature);
    if(tech||cust){doc.moveDown();doc.font('Helvetica-Bold').text('Tanda Tangan');const y=doc.y+4;if(tech)try{doc.image(tech,40,y,{fit:[220,70]})}catch(_){}if(cust)try{doc.image(cust,315,y,{fit:[220,70]})}catch(_){}doc.y=y+78;}
    if(photoFiles.length){
      doc.addPage();doc.font('Helvetica-Bold').fontSize(13).text('Dokumentasi Foto');
      for(let i=0;i<photoFiles.length;i++){
        const p=photoFiles[i];
        if(doc.y>690)doc.addPage();
        doc.font('Helvetica').fontSize(8).text((i+1)+'. '+path.basename(p));
        if(/\.(jpe?g|png)$/i.test(p)){try{doc.image(p,{fit:[500,260],align:'center'});doc.moveDown(.5)}catch(_){}}
      }
    }
    doc.fontSize(7).fillColor('#666').text('Generated by PixelApps Cloudinary Backup · '+new Date().toISOString(),36,806,{width:523,align:'center'});
    doc.end();
  });
}
function writeServicePdf(file,row,photoFiles){
  return new Promise((resolve,reject)=>{
    fs.mkdirSync(path.dirname(file),{recursive:true});const out=fs.createWriteStream(file,{mode:0o600});const doc=new PDFDocument({size:'A4',margin:36});out.on('finish',resolve);out.on('error',reject);doc.on('error',reject);doc.pipe(out);
    doc.font('Helvetica-Bold').fontSize(17).text('PIXEL SOLUSINDO');doc.fontSize(14).text('ARSIP SERVICE',{align:'right'});doc.moveDown();
    const fields=[['No. Service',row.service_number],['Customer',row.customer_name],['Perangkat',[row.device_type,row.brand,row.model].filter(Boolean).join(' ')],['Serial',row.serial_number],['Keluhan',row.complaint],['Status',row.status],['Teknisi',row.technician_name]];
    for(const [k,v] of fields){doc.font('Helvetica-Bold').fontSize(8).text(k+': ',{continued:true});doc.font('Helvetica').text(String(v||'-'));}
    if(photoFiles.length){doc.addPage();doc.font('Helvetica-Bold').fontSize(13).text('Dokumentasi Foto');for(let i=0;i<photoFiles.length;i++){if(doc.y>690)doc.addPage();const p=photoFiles[i];doc.font('Helvetica').fontSize(8).text((i+1)+'. '+path.basename(p));if(/\.(jpe?g|png)$/i.test(p)){try{doc.image(p,{fit:[500,260],align:'center'});doc.moveDown(.5)}catch(_){}}}}
    doc.fontSize(7).fillColor('#666').text('Generated by PixelApps Cloudinary Backup · '+new Date().toISOString(),36,806,{width:523,align:'center'});doc.end();
  });
}

function bucketFor(row){const d=recordDate(row)||anchor;return periodKey(mode,backfill?d:anchor);}
function selected(row){return backfill?!!recordDate(row):inPeriod(row,mode,anchor);}
async function backupPhotos(targetDir,photos,manifest,parent){
  const out=[];
  for(let i=0;i<photos.length;i++){
    const p=photos[i];const url=pickUrl(p);if(!url)continue;
    try{
      if(dryRun){manifest.files.push({parent,url,dry_run:true});continue;}
      const cache=await downloadToCache(p);const dst=path.join(targetDir,'photos',photoOutputName(p,i,cache));linkOrCopy(cache,dst);out.push(dst);
      manifest.files.push({parent,cloudinary_public_id:p.cloudinary_public_id||null,source_url:url,file:path.relative(CLOUD_ROOT,dst),bytes:fs.statSync(dst).size});
    }catch(e){manifest.errors.push({parent,photo_id:p.id||null,error:e.message});log('WARN '+parent+' photo gagal: '+e.message);}
  }
  return out;
}
async function main(){
  const [tickets,salesOrders,services]=await Promise.all([db.getTickets(null,true),db.getSalesOrders(),db.getServiceOrders()]);
  const soById=new Map(salesOrders.map(x=>[String(x.id),x]));
  const soByNo=new Map(salesOrders.map(x=>[String(x.so_number||''),x]));
  const manifest={revision:'PXL-SYS-0001A',created_at:new Date().toISOString(),period_mode:mode,anchor:anchor.toISOString(),backfill,completed,dry_run:dryRun,work_orders:0,services:0,files:[],errors:[]};
  log('Mulai Cloudinary backup mode='+mode+' backfill='+backfill+' dry_run='+dryRun);
  for(const t0 of tickets){
    if(!selected(t0))continue;
    const photos=await db.getWorkOrderPhotos(t0.id,false);if(!photos.length)continue;
    const so=soById.get(String(t0.sales_order_id||''))||soByNo.get(String(t0.so_number||''))||null;
    const t={...t0,so_number:t0.so_number||so?.so_number||null};
    const bucket=bucketFor(t);const base=path.join(CLOUD_ROOT,mode,bucket,woRelativePath(t));manifest.work_orders++;
    if(!dryRun){fs.mkdirSync(base,{recursive:true});fs.writeFileSync(path.join(base,'work-order.json'),JSON.stringify(t,null,2),{mode:0o600});if(so)fs.writeFileSync(path.join(base,'sales-order.json'),JSON.stringify(so,null,2),{mode:0o600});}
    const files=await backupPhotos(base,photos,manifest,t.wo_number||t.id);
    if(!dryRun)await writeWoPdf(path.join(base,'report',safeName(t.wo_number||t.id)+'-REPORT.pdf'),t,files);
  }
  for(const svc of services){
    if(!selected(svc))continue;
    const photos=await db.getServicePhotos(svc.id,false);if(!photos.length)continue;
    const bucket=bucketFor(svc);const base=path.join(CLOUD_ROOT,mode,bucket,serviceRelativePath(svc));manifest.services++;
    if(!dryRun){fs.mkdirSync(base,{recursive:true});fs.writeFileSync(path.join(base,'service-order.json'),JSON.stringify(svc,null,2),{mode:0o600});}
    const files=await backupPhotos(base,photos,manifest,svc.service_number||svc.id);
    if(!dryRun)await writeServicePdf(path.join(base,'report',safeName(svc.service_number||svc.id)+'-REPORT.pdf'),svc,files);
  }
  const manifestDir=path.join(CLOUD_ROOT,'manifests');fs.mkdirSync(manifestDir,{recursive:true});
  const name='cloudinary-'+mode+'-'+(backfill?'backfill-':'')+runStamp+'.json';
  if(!dryRun)fs.writeFileSync(path.join(manifestDir,name),JSON.stringify(manifest,null,2),{mode:0o600});
  log('Selesai: WO='+manifest.work_orders+' Service='+manifest.services+' files='+manifest.files.length+' errors='+manifest.errors.length);
  if(manifest.errors.length)process.exitCode=2;
}
main().catch(e=>{console.error(e);process.exit(1)});
