'use strict';
// PXL-URG-0133 — read-only next WO number, including archived tickets.
// Registers alongside existing authenticated GET /api/tickets; no DB/SQL migration.
const express=require('express');
const previousGet=express.application.get;
const KEY=Symbol.for('pxl.urg.0133.wo.number');
function nextWoNumber(rows,year){
  let high=0,width=6;
  const rx=new RegExp('^WO[-\\s]?'+year+'[-\\s]?(\\d+)$','i');
  for(const row of Array.isArray(rows)?rows:[]){
    const value=String(row?.wo_number||'').trim();
    const matched=value.match(rx);
    if(!matched)continue;
    high=Math.max(high,Number(matched[1])||0);
    width=Math.max(width,matched[1].length);
  }
  return 'WO-'+year+'-'+String(high+1).padStart(width,'0');
}
if(!express.application[KEY]){
  express.application[KEY]=true;
  express.application.get=function pxlUrg0133Get(path,...handlers){
    if(path==='/api/tickets'&&!this.__pxl0133NumberRouteRegistered){
      this.__pxl0133NumberRouteRegistered=true;
      const auth=handlers.slice(0,-1);
      previousGet.call(this,'/api/tickets/next-number',...auth,async(req,res)=>{
        try{
          const db=require('./db');
          // Include archived tickets: the existing POST /api/tickets duplicate check does.
          const tickets=await db.getTickets(null,true);
          const witaYear=new Date(Date.now()+8*3600e3).getUTCFullYear();
          const wo_number=nextWoNumber(tickets,witaYear);
          res.setHeader('Cache-Control','no-store, max-age=0');
          return res.json({wo_number});
        }catch(error){
          console.error('[PXL-URG-0133] next WO failed',error);
          return res.status(500).json({error:'Gagal membaca nomor WO terakhir.'});
        }
      });
    }
    return previousGet.call(this,path,...handlers);
  };
}
module.exports={nextWoNumber};
