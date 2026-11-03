'use strict';
// PXL-URG-0122 — isolated WO mobile action UI loader only.
const express=require('express');
const fs=require('fs');
const path=require('path');
const KEY=Symbol.for('pxl.urg.0122.wo.mobile.actions');
function inject(html){
  const src=String(html||'');
  const tag='<script src="/pxl-urg-0122-wo-mobile-actions.js?v=PXL-URG-0122"></script>';
  return src.includes('/pxl-urg-0122-wo-mobile-actions.js')?src:src.replace('</body>',tag+'\n</body>');
}
if(!global[KEY]){
  global[KEY]=true;
  const prior=express.static;
  express.static=function pxlUrg0122Static(root,options){
    const native=prior(root,options);
    const isPublic=path.resolve(String(root||''))===path.resolve(__dirname,'public');
    if(!isPublic)return native;
    return function(req,res,next){
      const pathname=String(req.path||req.url||'').split('?')[0];
      if(pathname==='/'||pathname==='/index.html'){
        try{res.setHeader('Cache-Control','no-store, max-age=0');return res.type('html').send(inject(fs.readFileSync(path.join(root,'index.html'),'utf8')));}
        catch(_){return native(req,res,next);}
      }
      return native(req,res,next);
    };
  };
}
module.exports={inject};