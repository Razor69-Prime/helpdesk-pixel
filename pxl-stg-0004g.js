'use strict';

// PXL-STG-0004G — inject linked WO selection fix without replacing index.html.
const fs=require('fs');
const path=require('path');
const express=require('express');
const originalStatic=express.static;

express.static=function pxl0004gStatic(root,options){
  const middleware=originalStatic(root,options);
  const indexPath=path.join(root,'index.html');
  return function pxl0004gMiddleware(req,res,next){
    if(req.method==='GET'&&(req.path==='/'||req.path==='/index.html')&&fs.existsSync(indexPath)){
      try{
        let html=fs.readFileSync(indexPath,'utf8');
        const tag='<script src="/pxl-stg-0004g.js?v=PXL-STG-0004G"></script>';
        if(!html.includes('/pxl-stg-0004g.js'))html=html.replace('</body>',tag+'\n</body>');
        res.setHeader('Cache-Control','no-store, max-age=0');
        return res.type('html').send(html);
      }catch(_){return middleware(req,res,next);}
    }
    return middleware(req,res,next);
  };
};
