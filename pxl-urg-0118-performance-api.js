'use strict';

// PXL-URG-0118 — compact MR payload + isolated frontend loader/static optimization.
const express=require('express');
const fs=require('fs');
const path=require('path');
const PATCH_KEY=Symbol.for('pxl.urg.0118.performance.api');
const STATIC_KEY=Symbol.for('pxl.urg.0118.performance.static');

function compactMrRows(rows){
  return (Array.isArray(rows)?rows:[]).map(row=>{
    const out={...row};
    out.has_requester_signature=Boolean(out.requester_signature);
    out.has_technician_signature=Boolean(out.technician_signature);
    out.has_prepared_signature=Boolean(out.prepared_signature);
    delete out.requester_signature;
    delete out.technician_signature;
    delete out.prepared_signature;
    return out;
  });
}

function injectPerformanceLoader(html){
  const tag='<script src="/pxl-urg-0118-performance.js?v=PXL-URG-0118"></script>';
  if(String(html||'').includes('/pxl-urg-0118-performance.js'))return String(html||'');
  return String(html||'').replace('</body>',tag+'\n</body>');
}
function optimizeLegacyPdfAsset(source){
  return String(source||'').replace(
    "async function getSalesOrders(){const report=await json('/api/crm/report');return Array.isArray(report.sales_orders)?report.sales_orders:[];}",
    "async function getSalesOrders(){const rows=await json('/api/sales-orders');return Array.isArray(rows)?rows:[];}"
  );
}

if(!global[STATIC_KEY]){
  global[STATIC_KEY]=true;
  const originalStatic=express.static;
  express.static=function pxlUrg0118Static(root,options){
    const native=originalStatic(root,options);
    const isPublic=path.resolve(String(root||''))===path.resolve(__dirname,'public');
    if(!isPublic)return native;
    return function pxlUrg0118PublicStatic(req,res,next){
      const pathname=String(req.path||req.url||'').split('?')[0];
      if(pathname==='/'||pathname==='/index.html'){
        try{
          const html=injectPerformanceLoader(fs.readFileSync(path.join(root,'index.html'),'utf8'));
          res.setHeader('Cache-Control','no-store, max-age=0');
          return res.type('html').send(html);
        }catch(_){return native(req,res,next);}
      }
      if(pathname==='/pxl-stg-0006k-polish.js'){
        try{
          const js=optimizeLegacyPdfAsset(fs.readFileSync(path.join(root,'pxl-stg-0006k-polish.js'),'utf8'));
          res.setHeader('Cache-Control','no-store, max-age=0');
          return res.type('application/javascript').send(js);
        }catch(_){return native(req,res,next);}
      }
      return native(req,res,next);
    };
  };
}

if(!global[PATCH_KEY]){
  global[PATCH_KEY]=true;
  const originalGet=express.application.get;
  express.application.get=function pxlUrg0118Get(route,...handlers){
    const routeText=String(route||'');
    if(routeText==='/api/material-requests-form'&&handlers.length){
      const authHandlers=handlers.slice(0,-1);
      const compactHandler=async(req,res)=>{
        try{const db=require('./db');res.json(compactMrRows(await db.getMRForms()));}
        catch(e){res.status(500).json({error:e.message});}
      };
      const result=originalGet.call(this,route,...authHandlers,compactHandler);
      originalGet.call(this,'/api/material-requests-form/:id/detail',...authHandlers,async(req,res)=>{
        try{
          const db=require('./db');
          const row=(await db.getMRForms()).find(x=>String(x.id)===String(req.params.id));
          if(!row)return res.status(404).json({error:'Material Request tidak ditemukan.'});
          res.json(row);
        }catch(e){res.status(500).json({error:e.message});}
      });
      return result;
    }
    return originalGet.call(this,route,...handlers);
  };
}

module.exports={compactMrRows,injectPerformanceLoader,optimizeLegacyPdfAsset};