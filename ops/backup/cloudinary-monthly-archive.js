#!/usr/bin/env node
'use strict';

const path=require('path');
const {
  listPeriods,prepareArchive,archivePath
}=require('./cloudinary-retention-lib');

const BACKUP_ROOT=process.env.BACKUP_ROOT||'/home/deploy/pixelapps-backups';
const CLOUD_ROOT=path.join(BACKUP_ROOT,'cloudinary');
const args=process.argv.slice(2);
const allCompleted=args.includes('--all-completed');
const arg=(name,def=null)=>{const i=args.indexOf(name);return i>=0&&args[i+1]?args[i+1]:def};
const explicit=arg('--period',null);

function currentWitaMonth(now=new Date()){
  const d=new Date(now.getTime()+8*3600000);
  return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
}
function previousWitaMonth(now=new Date()){
  const d=new Date(now.getTime()+8*3600000);
  const p=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1));
  return p.getUTCFullYear()+'-'+String(p.getUTCMonth()+1).padStart(2,'0');
}
function main(){
  const periods=listPeriods(CLOUD_ROOT,'monthly');
  const current=currentWitaMonth();
  let targets;
  if(explicit) targets=[explicit];
  else if(allCompleted) targets=periods.filter(p=>p<current);
  else targets=[previousWitaMonth()];
  targets=targets.filter(p=>periods.includes(p));
  if(!targets.length){console.log('PXL-SYS-0001B1 no completed monthly archive target');return}
  for(const period of targets){
    const file=prepareArchive(CLOUD_ROOT,period);
    console.log('PXL-SYS-0001B1 archive ready:',period,archivePath(CLOUD_ROOT,period),file);
  }
}
try{main()}catch(e){console.error('[PXL-SYS-0001B1] auto archive gagal:',e.message||e);process.exit(1)}
