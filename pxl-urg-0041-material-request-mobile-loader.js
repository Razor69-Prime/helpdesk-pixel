'use strict';
/* PXL-URG-0041B — isolated Material Request mobile UI loader only.
 * Injects frontend readability CSS/JS into main app HTML.
 * Does not alter Material Request flow, calculation, API, Inventory, or database.
 */
const express=require('express');
const fs=require('fs');
const path=require('path');
if(!express.__pxl0041StaticPatched){
  express.__pxl0041StaticPatched=true;
  const originalStatic=express.static;
  express.static=function pxl0041Static(root,...args){
    const middleware=originalStatic.call(this,root,...args);
    if(path.basename(String(root||''))!=='public')return middleware;
    const indexPath=path.join(root,'index.html');
    return function pxl0041PublicStatic(req,res,next){
      if((req.path==='/'||req.path==='/index.html')&&fs.existsSync(indexPath)){
        try{
          let html=fs.readFileSync(indexPath,'utf8');
          const tag='<script src="/pxl-urg-0041-material-request-mobile-ui.js?v=PXL-URG-0041B" data-pxl-mr-mobile-ui="0041B"></script>';
          html=html.replace(/<script src="\/pxl-urg-0041-material-request-mobile-ui\.js\?v=PXL-URG-0041[^"]*" data-pxl-mr-mobile-ui="0041[^"]*"><\/script>/g,'');
          if(!html.includes('data-pxl-mr-mobile-ui="0041B"'))html=html.replace('</body>',tag+'\n</body>');
          res.setHeader('Cache-Control','no-store, max-age=0');
          res.setHeader('Pragma','no-cache');
          return res.type('html').send(html);
        }catch(e){console.warn('[PXL-URG-0041B] loader fallback:',e?.message||e);}
      }
      return middleware(req,res,next);
    };
  };
}
