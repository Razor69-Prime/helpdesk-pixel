'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const match=require('../public/pxl-wh-0001d-matching');
const ui=fs.readFileSync(path.join(__dirname,'../public/pxl-wh-0001-ui.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const official=[
 {id:'1',sku:'PX-MICRO-64',name:'Micro SD Imou 64GB',unit:'pcs'},
 {id:'2',sku:'PX-MICRO-128',name:'Micro SD Imou 128GB',unit:'pcs'},
 {id:'3',sku:'PX-MICRO-OTHER',name:'Micro SD Hiksemi 64GB',unit:'pcs'},
 {id:'4',sku:'PX-H8C',name:'Camera CCTV Ezviz H8C 4MP',unit:'pcs'},
 {id:'5',sku:'PX-H9C',name:'Paket Camera CCTV Ezviz H9C 4MP',unit:'paket'},
 {id:'6',sku:'PX-CABLE-50',name:'Kabel Listrik NYYHY Putih 50 Meter',unit:'meter'},
 {id:'7',sku:'PX-STECKER-A',name:'Steker Listrik Broco Kontra',unit:'pcs'},
 {id:'8',sku:'PX-STECKER-B',name:'Steker T',unit:'pcs'},
 {id:'9',sku:'PX-DURADUS',name:'Duradus Listrik Hitam 128x128x75',unit:'pcs'},
 {id:'10',sku:'PX-KLEM',name:'Klem Kabel Masko 10mm',unit:'pcs'}];
test('exact linked inventory and PX items still autofill normally',()=>{
 const row={items:[{name:'Micro SD Imou 64GB',inventory_item_id:'1',qty:2},{name:'Steker',sku:'PX-STECKER-B',qty:3}]};
 const p=match.proposals(row,official);
 assert.deepEqual(p.map(x=>x.sku),['PX-MICRO-64','PX-STECKER-B']);
 assert.equal(p[0].planned_qty,2);
});
test('manual text gets candidate suggestions but never auto-selects SKU',()=>{
 const row={items:[{name:'Micro SD 64gb Imou',qty:1,source:'SO'}]};
 const p=match.proposals(row,official);
 assert.equal(p[0].catalog_item,null);
 assert.equal(p[0].sku,'');
 const suggestions=match.suggestOfficial({name:p[0].name},official);
 assert.equal(suggestions[0].item.sku,'PX-MICRO-64');
 assert.equal(suggestions.every(x=>x.item.name.toLowerCase().includes('imou')),true);
 assert.ok(suggestions.length<=3);
});
test('different camera model or unverified package cannot be suggested as equivalent',()=>{
 assert.deepEqual(match.suggestOfficial({name:'Paket Camera Ezviz H8C 4 MP'},official),[]);
});
test('2 Meter cable cannot suggest 50 Meter cable',()=>{
 assert.deepEqual(match.suggestOfficial({name:'Kabel Listrik 2 Meter'},official),[]);
});
test('short ambiguous names show at most three manual candidates, without auto mapping',()=>{
 const p=match.proposals({items:[{name:'Steker'},{name:'Duradus'},{name:'Klem'}]},official);
 assert.equal(p.filter(x=>x.catalog_item).length,0);
 for(const x of p){
  const list=match.suggestOfficial({name:x.name},official);
  assert.ok(list.length>=1&&list.length<=3);
  assert.ok(list.every(v=>v.item.sku.startsWith('PX-')));
 }
});
test('Warehouse UI requires explicit candidate button click before adding to unsaved draft',()=>{
 assert.match(ui,/data-wh-suggest/);
 assert.match(ui,/Pilih Kandidat/);
 assert.match(ui,/matcher\.suggestOfficial\?/);
 assert.match(ui,/button\.onclick=\(\)=>\{/);
 assert.match(ui,/appendLine\(candidate,original\.planned_qty,'KONFIRMASI SO\/WO'\)/);
 assert.match(ui,/Kandidat hanya saran dan tidak dipilih otomatis/);
 assert.match(ui,/Simpan Semua sebagai Draft/);
 assert.match(ui,/Finalisasi Pemakaian/);
});
test('static candidate script and updated Warehouse UI version are deployed together',()=>{
 assert.ok(html.indexOf('pxl-wh-0001d-matching.js?v=PXL-WH-0001J')>0);
 assert.ok(html.indexOf('pxl-wh-0001-ui.js?v=PXL-WH-0001J')>0);
 assert.ok(html.indexOf('pxl-wh-0001d-matching.js')<html.indexOf('pxl-wh-0001-ui.js'));
});
