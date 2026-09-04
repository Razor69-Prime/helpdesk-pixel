'use strict';
/* PXL-URG-0040A / 0040B / 0040C / 0040D / 0040E — isolated bootstrap for Master Pricelist.
 * Guarantees the Superadmin-only frontend module is loaded from the main app HTML.
 * 0043 adds persistent cache, last-sync fallback and price history while Google Sheet stays read-only.
 * Does not touch Pricing Calculator, Inventory, Sales Order, database, or Google Sheet writes.
 */
const express=require('express');
const fs=require('fs');
const path=require('path');

if(!express.__pxl0040aStaticPatched){
  express.__pxl0040aStaticPatched=true;
  const originalStatic=express.static;
  express.static=function pxl0040aStatic(root,...args){
    const middleware=originalStatic.call(this,root,...args);
    const isPublic=path.basename(String(root||''))==='public';
    if(!isPublic)return middleware;
    const indexPath=path.join(root,'index.html');
    return function pxl0040aPublicStatic(req,res,next){
      if((req.path==='/'||req.path==='/index.html')&&fs.existsSync(indexPath)){
        try{
          let html=fs.readFileSync(indexPath,'utf8');
          const tag='<script src="/pxl-urg-0040-master-pricelist-menu.js?v=PXL-URG-0043A" data-pxl-master-pricelist-bootstrap="0043A"></script>';
          if(!html.includes('data-pxl-master-pricelist-bootstrap="0043A"'))html=html.replace('</body>',tag+'\n</body>');
          res.setHeader('Cache-Control','no-store, max-age=0');
          res.setHeader('Pragma','no-cache');
          return res.type('html').send(html);
        }catch(e){
          console.warn('[PXL-URG-0043A] bootstrap gagal, fallback static:',e?.message||e);
        }
      }
      return middleware(req,res,next);
    };
  };
}
