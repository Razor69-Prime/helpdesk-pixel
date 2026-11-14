'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const css=read('public/pxl-urg-0141-service-reminder-header.css');
const service=read('public/pxl-urg-0077-service-center.js');
const {inject}=require('../pxl-urg-0121-pr-live-load-hook');

test('0141 inserts exactly one external stylesheet in served index while preserving existing loaders',()=>{
  const original=read('public/index.html');
  const page=inject(original);
  const href='/pxl-urg-0141-service-reminder-header.css?v=PXL-URG-0141';
  assert.equal(page.split(href).length-1,1);
  assert.ok(page.indexOf(href)<page.indexOf('</head>'));
  assert.equal(inject(page),page,'injection is idempotent');
  for(const stable of ['/pxl-urg-0139-wo-tracking-wa.js?v=PXL-URG-0139',
    '/pxl-urg-0032a-remarks-button-fix.js?v=PXL-URG-0135',
    '/pxl-stg-0004d.js?v=PXL-URG-0134',
    '/pxl-urg-0010-wo-autonumber.js?v=PXL-URG-0133',
    '/pxl-urg-0040-master-pricelist-menu.js?v=PXL-URG-0132']){
    assert.ok(page.includes(stable),stable);
  }
});

test('0141 desktop Service Reminder is fixed below header, not a flex-width child',()=>{
  assert.match(css,/#app \.topbar \.topbar-right > \.svc-toast\s*\{[^}]*position:fixed;/s);
  assert.match(css,/#app \.topbar \.topbar-right > \.svc-toast\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) auto;/s);
  assert.match(css,/#app \.topbar \.topbar-right > \.svc-toast\s*\{[^}]*flex:none;/s);
  assert.match(css,/#app \.topbar \.topbar-right > \.svc-toast\s*\{[^}]*width:min\(390px,calc\(100vw - 24px\)\);/s);
  assert.match(css,/#app \.topbar \.topbar-right > \.svc-toast\.show\s*\{[^}]*opacity:1;[^}]*transform:translateY\(0\)/s);
  // Reminder can appear before Service Center is rendered; standalone CSS must fully style it.
  for(const property of ['background:#fff7da;','border:1px solid #ead28a;','border-radius:11px;','box-shadow:','opacity:0;','transition:opacity']){
    assert.ok(css.includes(property),property);
  }
  assert.doesNotMatch(css,/\.user-pill\s*\{|\.notif-bell\s*\{|\.logout-btn\s*\{/,'other header elements left alone');
});

test('0141 reminder CTA stays on right, never wraps onto a second row',()=>{
  assert.match(css,/> #svc-toast-open\s*\{[^}]*white-space:nowrap;/s);
  assert.match(css,/> #svc-toast-open\s*\{[^}]*flex:0 0 auto;/s);
  assert.match(css,/> \.svc-toast > div\s*\{[^}]*min-width:0;/s);
  assert.match(css,/overflow-wrap:break-word;/);
  const excerpt=service.slice(service.indexOf('async function showReminder()'),service.indexOf('window.pxlServiceCenter='));
  assert.match(excerpt,/<button class="btn sm" id="svc-toast-open">Lihat<\/button>/);
  assert.match(excerpt,/t\.querySelector\('#svc-toast-open'\)\.onclick=/);
  assert.match(excerpt,/switchTab\('service_center',b\)/);
  assert.match(excerpt,/activeFilter='overdue'/);
});

test('0141 PWA/mobile uses viewport-sized floating toast without changing topbar position',()=>{
  assert.match(css,/@media\(max-width:800px\)\s*\{[^]*?position:fixed;[^]*?width:min\(360px,calc\(100vw - 16px\)\);/);
  assert.match(css,/@media\(max-width:390px\)\s*\{/);
  assert.match(css,/body\.pxl-staging #app \.topbar \.topbar-right > \.svc-toast/);
  assert.doesNotMatch(css,/#app \.topbar\s*\{[^}]*position:/s);
  for(const viewport of [320,375,390,414,768,1226]){
    const maximum=viewport<=800?Math.min(360,viewport-16):Math.min(390,viewport-24);
    assert.ok(maximum<=viewport-16);
    assert.ok(maximum>=200);
  }
});

test('0141 remains CSS-only, original reminder API/permissions/lifetime unchanged',()=>{
  const src=read('pxl-urg-0121-pr-live-load-hook.js');
  assert.match(src,/reminderHeaderCss/);
  assert.doesNotMatch(css,/@import|url\(/i);
  assert.match(service,/api\('GET','\/service-center\/reminders'\)/);
  assert.match(service,/sessionStorage\.getItem\('pxl-service-reminder-shown'\)/);
  assert.match(service,/5500/);
});
