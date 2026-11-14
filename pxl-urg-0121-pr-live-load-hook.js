'use strict';
// PXL-URG-0121 — isolated PR-only frontend loader. Project Tracker is untouched.
const express=require('express');
const fs=require('fs');
const path=require('path');
const {patchWoDetail}=require('./pxl-urg-0123-wo-detail-safe');
const {patchWoMobileGrid}=require('./pxl-urg-0124-wo-mobile-grid');
const {patchWoMenuDateSync}=require('./pxl-urg-0125-wo-menu-date-sync');
const {patchWoOptionalTechnician}=require('./pxl-urg-0131-wo-optional-tech');
const {patchWoSubmitNumber}=require('./pxl-urg-0133-wo-number-submit');
require('./pxl-urg-0133-wo-number-api');
const KEY=Symbol.for('pxl.urg.0121.pr.loader');
function inject(html){
  const src=String(html||'');
  const prTag='<script src="/pxl-urg-0121-pr-live-load.js?v=PXL-URG-0121"></script>';
  // PXL-URG-0132: 0121 serves index.html directly, bypassing the legacy 0040A
  // Master Pricelist menu injector. Restore its existing permission-aware module.
  const masterTag='<script src="/pxl-urg-0040-master-pricelist-menu.js?v=PXL-URG-0132" data-pxl-master-pricelist-bootstrap="0132"></script>';
  const woNumberTag='<script src="/pxl-urg-0010-wo-autonumber.js?v=PXL-URG-0133"></script>';
  // PXL-URG-0134 — restore existing live material fast search for MR input.
  // Loader 0121 bypassed the original 0004D index injector; no MR flow/API change.
  const mrSearchTag='<script src="/pxl-stg-0004d.js?v=PXL-URG-0134"></script>';
  // PXL-URG-0135: restore native Add/Edit Remarks click handler and inline refresh.
  // The 0121 index response bypasses the legacy 0032A remarks script injector.
  const remarksTag='<script src="/pxl-urg-0032a-remarks-button-fix.js?v=PXL-URG-0135"></script>';
  // PXL-URG-0139 — customer-specific tracking WhatsApp message, read-only UI.
  const trackWaTag='<script src="/pxl-urg-0139-wo-tracking-wa.js?v=PXL-URG-0139"></script>';
  // PXL-URG-0141 — float Service Reminder below the header instead of stretching its flex row.
  const reminderHeaderCss='<link rel="stylesheet" href="/pxl-urg-0141-service-reminder-header.css?v=PXL-URG-0141">';
  // PXL-URG-0142 — one-day, Superadmin-only Service Reminder visual test.
  const reminderTestTag='<script src="/pxl-urg-0142-service-reminder-test.js?v=PXL-URG-0142"></script>';
  let result=src;
  if(!result.includes('/pxl-urg-0121-pr-live-load.js'))result=result.replace('</body>',prTag+'\n</body>');
  if(!result.includes('/pxl-urg-0040-master-pricelist-menu.js'))result=result.replace('</body>',masterTag+'\n</body>');
  if(!result.includes('/pxl-urg-0010-wo-autonumber.js'))result=result.replace('</body>',woNumberTag+'\n</body>');
  if(!result.includes('/pxl-stg-0004d.js'))result=result.replace('</body>',mrSearchTag+'\n</body>');
  if(!result.includes('/pxl-urg-0032a-remarks-button-fix.js'))result=result.replace('</body>',remarksTag+'\n</body>');
  if(!result.includes('/pxl-urg-0139-wo-tracking-wa.js'))result=result.replace('</body>',trackWaTag+'\n</body>');
  if(!result.includes('/pxl-urg-0141-service-reminder-header.css'))result=result.replace('</head>',reminderHeaderCss+'\n</head>');
  if(!result.includes('/pxl-urg-0142-service-reminder-test.js'))result=result.replace('</body>',reminderTestTag+'\n</body>');
  return result;
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
        try{res.setHeader('Cache-Control','no-store, max-age=0');return res.type('html').send(inject(patchWoSubmitNumber(patchWoOptionalTechnician(patchWoMenuDateSync(patchWoMobileGrid(patchWoDetail(fs.readFileSync(path.join(root,'index.html'),'utf8'))))))));}
        catch(_){return native(req,res,next);}
      }
      return native(req,res,next);
    };
  };
}
module.exports={inject};