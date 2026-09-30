'use strict';

const path=require('path');

function pad2(n){return String(n).padStart(2,'0');}

function isoWeekParts(date){
  const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const year=d.getUTCFullYear();
  const yearStart=new Date(Date.UTC(year,0,1));
  const week=Math.ceil((((d-yearStart)/86400000)+1)/7);
  return {year,week};
}

function periodKey(mode,date=new Date()){
  if(mode==='monthly') return date.getUTCFullYear()+'-'+pad2(date.getUTCMonth()+1);
  if(mode==='weekly'){
    const p=isoWeekParts(date);
    return p.year+'-W'+pad2(p.week);
  }
  throw new Error('Period harus weekly atau monthly.');
}

function safeName(v){
  const s=String(v||'unknown').trim().replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'');
  return s||'unknown';
}

function woFolderName(row={}){
  const wo=safeName(row.wo_number||row.id||'WO');
  const so=row.so_number?safeName(row.so_number):'';
  return so?wo+'__SO-'+so:wo;
}

function recordDate(row={}){
  const raw=row.worked_at||row.scheduled_date||row.received_at||row.created_at||row.uploaded_at;
  const d=new Date(raw||0);
  return Number.isFinite(d.getTime())?d:null;
}

function inPeriod(row,mode,anchor=new Date()){
  const d=recordDate(row);
  if(!d)return false;
  return periodKey(mode,d)===periodKey(mode,anchor);
}

function woRelativePath(row={}){
  const wo=safeName(row.wo_number||row.id||'WO');
  if(row.so_number) return path.join('SO',safeName(row.so_number),'WO',wo);
  return path.join('WO',wo);
}

function serviceRelativePath(row={}){
  return path.join('SERVICE',safeName(row.service_number||row.id||'SERVICE'));
}

module.exports={periodKey,safeName,woFolderName,recordDate,inPeriod,woRelativePath,serviceRelativePath};
