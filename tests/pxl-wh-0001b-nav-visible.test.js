'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
test('warehouse navigation is grouped after purchasing and expanded when user is authorized',()=>{
 const start=html.indexOf('const NAV_GROUPS=['),end=html.indexOf('];',start);
 const nav=html.slice(start,end);
 assert.ok(nav.indexOf("label:'Gudang'")>nav.indexOf("label:'Ringkasan & Kinerja'"));
 assert.ok(nav.indexOf("label:'Gudang'")>nav.indexOf("label:'Keuangan & Pengadaan'"));
 assert.ok(nav.indexOf("label:'Gudang'")<nav.indexOf("label:'Administrasi'"));
 assert.match(html,/const savedOpen=\(group\.label==='Gudang'&&canWarehouse\)/);
 assert.match(html,/tabs=tabs\.filter\(t=>t\.id!=='warehouse_mr'\|\|canWarehouse\)/);
 assert.match(html,/data-tab-id="\$\{t\.id\}"/);
});
