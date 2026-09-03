'use strict';
/* PXL-URG-0041C — isolated Material Request mobile UI loader only.
 * Patches presentation of the original MR table before serving index.html.
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

          // 0041C: target the real original table directly. Header text/flow remain untouched.
          html=html.replace(
            '<table style="width:100%;border-collapse:collapse;font-size:12px" id="mr-items-table">',
            '<table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed" id="mr-items-table" data-pxl-mr-layout="0041C">'
          );

          const css=`<style data-pxl-mr-core-layout="0041C">
@media(max-width:700px){
  #mr-items-table{table-layout:fixed!important;width:100%!important;max-width:100%!important;min-width:0!important}
  #mr-items-table th,#mr-items-table td{box-sizing:border-box!important;min-width:0!important;padding:5px 2px!important}
  #mr-items-table th{font-size:8.5px!important;line-height:1.12!important;white-space:normal!important;overflow-wrap:anywhere!important;text-align:center!important}
  #mr-items-table th:nth-child(1),#mr-items-table td:nth-child(1){width:7%!important;max-width:7%!important}
  #mr-items-table th:nth-child(2),#mr-items-table td:nth-child(2){width:46%!important;max-width:46%!important}
  #mr-items-table th:nth-child(3),#mr-items-table td:nth-child(3),#mr-items-table th:nth-child(4),#mr-items-table td:nth-child(4),#mr-items-table th:nth-child(5),#mr-items-table td:nth-child(5){width:13%!important;max-width:13%!important;text-align:center!important}
  #mr-items-table th:nth-child(6),#mr-items-table td:nth-child(6){width:8%!important;max-width:8%!important}
  #mr-items-table .mr-qout,#mr-items-table .mr-quse,#mr-items-table .mr-qret{font-size:10px!important;padding:3px 1px!important;min-width:0!important;width:100%!important;text-align:center!important}
}
</style>`;
          html=html.replace(/<style data-pxl-mr-core-layout="0041C">[\s\S]*?<\/style>/g,'');
          html=html.replace('</head>',css+'\n</head>');

          const tag='<script src="/pxl-urg-0041-material-request-mobile-ui.js?v=PXL-URG-0041C" data-pxl-mr-mobile-ui="0041C"></script>';
          html=html.replace(/<script src="\/pxl-urg-0041-material-request-mobile-ui\.js\?v=PXL-URG-0041[^"]*" data-pxl-mr-mobile-ui="0041[^"]*"><\/script>/g,'');
          html=html.replace('</body>',tag+'\n</body>');
          res.setHeader('Cache-Control','no-store, max-age=0');
          res.setHeader('Pragma','no-cache');
          return res.type('html').send(html);
        }catch(e){console.warn('[PXL-URG-0041C] loader fallback:',e?.message||e);}
      }
      return middleware(req,res,next);
    };
  };
}
