'use strict';
// PXL-URG-0121 — isolated PR-only frontend loader. Project Tracker is untouched.
const express=require('express');
const fs=require('fs');
const path=require('path');
const {patchWoDetail}=require('./pxl-urg-0123-wo-detail-safe');
const {patchWoMobileGrid}=require('./pxl-urg-0124-wo-mobile-grid');
const {patchWoMenuDateSync}=require('./pxl-urg-0125-wo-menu-date-sync');
const {patchWoOptionalTechnician}=require('./pxl-urg-0131-wo-optional-tech');
const KEY=Symbol.for('pxl.urg.0121.pr.loader');
function inject(html){
  const src=String(html||'');
  const tag='<script src="/pxl-urg-0121-pr-live-load.js?v=PXL-URG-0121"></script>';
  return src.includes('/pxl-urg-0121-pr-live-load.js')?src:src.replace('</body>',tag+'\n</body>');
}
if(!global[KEY]){
  global[KEY]=true;
  const prior=express.static;
  express.static=function pxlUrg0121Static(root,options){
    const native=prior(root,options);
    const isPublic=path.resolve(String(root||''))===path.resolve(__dirname,'public');
    if(!isPublic)return native;
    return function(req,res,next){
      const pathname=String(req.path||req.url||'').split('?')[0];
      if(pathname==='/'||pathname==='/index.html'){
        try{res.setHeader('Cache-Control','no-store, max-age=0');return res.type('html').send(inject(patchWoOptionalTechnician(patchWoMenuDateSync(patchWoMobileGrid(patchWoDetail(fs.readFileSync(path.join(root,'index.html'),'utf8')))))));}
        catch(_){return native(req,res,next);}
      }
      return native(req,res,next);
    };
  };
}
module.exports={inject};