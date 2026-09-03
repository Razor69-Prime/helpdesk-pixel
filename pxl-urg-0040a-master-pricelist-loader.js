'use strict';
/* PXL-URG-0040A / 0040B — isolated bootstrap for Master Pricelist.
 * Guarantees the Superadmin-only frontend module is loaded from the main app HTML.
 * 0040B adds mobile-only responsive cards to Master Pricelist without changing sync/parser/data.
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
    const masterPath=path.join(root,'master-pricelist.html');
    return function pxl0040aPublicStatic(req,res,next){
      if((req.path==='/'||req.path==='/index.html')&&fs.existsSync(indexPath)){
        try{
          let html=fs.readFileSync(indexPath,'utf8');
          const tag='<script src="/pxl-urg-0040-master-pricelist-menu.js?v=PXL-URG-0040B" data-pxl-master-pricelist-bootstrap="0040B"></script>';
          if(!html.includes('data-pxl-master-pricelist-bootstrap="0040B"'))html=html.replace('</body>',tag+'\n</body>');
          res.setHeader('Cache-Control','no-store, max-age=0');
          res.setHeader('Pragma','no-cache');
          return res.type('html').send(html);
        }catch(e){
          console.warn('[PXL-URG-0040B] bootstrap gagal, fallback static:',e?.message||e);
        }
      }

      if(req.path==='/master-pricelist.html'&&fs.existsSync(masterPath)){
        try{
          let html=fs.readFileSync(masterPath,'utf8');
          const css=`<style data-pxl-master-pricelist-mobile="0040B">
@media(max-width:720px){
  #app .card:last-child{padding:12px}
  #app .card:last-child>div[style*="overflow:auto"]{overflow:visible!important;max-height:none!important}
  #app table,#app tbody,#app tr,#app td{display:block;width:100%}
  #app thead{display:none!important}
  #app tbody{display:grid;gap:10px}
  #app tbody tr{position:relative;background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px 13px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
  #app tbody td{border:0!important;padding:0!important;text-align:left!important}
  #app tbody td:nth-child(1),#app tbody td:nth-child(2){display:inline-block;width:auto;margin:0 6px 8px 0;vertical-align:middle}
  #app tbody td:nth-child(2){font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.035em;padding:4px 7px!important;background:#f3f1ec;border-radius:999px!important}
  #app tbody td:nth-child(3){font-size:13px;line-height:1.38;margin:1px 0 9px;overflow-wrap:anywhere;word-break:normal}
  #app tbody td:nth-child(3) b{font-weight:700}
  #app tbody td:nth-child(4){font-size:15px;line-height:1.2;color:var(--text);padding-top:9px!important;border-top:1px solid #eee!important}
  #app tbody td:nth-child(4)::before{content:'HPP (Non PPN)';display:block;font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
  #app tbody td:nth-child(5){display:none!important}
  #app tbody tr:has(td.empty){display:block;padding:0;border:0;box-shadow:none;background:transparent}
  #app tbody td.empty{display:block!important;padding:24px 8px!important;text-align:center!important}
}
</style>`;
          if(!html.includes('data-pxl-master-pricelist-mobile="0040B"'))html=html.replace('</head>',css+'\n</head>');
          res.setHeader('Cache-Control','no-store, max-age=0');
          res.setHeader('Pragma','no-cache');
          return res.type('html').send(html);
        }catch(e){
          console.warn('[PXL-URG-0040B] mobile layout inject gagal, fallback static:',e?.message||e);
        }
      }

      return middleware(req,res,next);
    };
  };
}
