'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const exp=require('../public/pxl-wh-0001i-export');
const html=fs.readFileSync(path.resolve(__dirname,'../public/index.html'),'utf8');
const ui=fs.readFileSync(path.resolve(__dirname,'../public/pxl-wh-0001-ui.js'),'utf8');
const base={wh_number:'WH-2026-0001',so_number:'SO-2026-0001',wo_number:'WO-2026-0001',source_key:'so:1',
 customer:'PT Contoh',job:'Instalasi',technicians:['Teknisi A','Teknisi B'],
 mr_numbers:['internal-uuid-1','internal-uuid-2'],status:'done',so_status:'approved',wo_status:'closed'};
test('Material per SO/WO exports work and detailed official SKU separately, never MR UUID',()=>{
 const sheets=exp.materials([{...base,items:[{name:'Camera CCTV',sku:'PX-CC-100',unit:'pcs',qty:2,source:'SO'}],
 manual_items:[{name:'Kabel',sku:'PX-KB-200',qty:100,unit:'meter',source:'MANUAL'}]}]);
 assert.deepEqual(sheets.map(s=>s.name),['Pekerjaan','Detail Material']);
 assert.equal(sheets[0].rows[0]['Customer'],'PT Contoh');
 assert.equal(sheets[0].rows[0]['Teknisi'],'Teknisi A, Teknisi B');
 assert.equal(sheets[0].rows[0]['Form MR (Jumlah)'],2);
 assert.equal(JSON.stringify(sheets).includes('internal-uuid'),false);
 assert.equal(sheets[1].rows.length,2);
 assert.equal(sheets[1].rows[0]['SKU'],'PX-CC-100');
 assert.equal(sheets[1].rows[1]['Qty Rencana'],100);
});
test('Daily usage separates DRAFT, FINAL and existing legacy USED',()=>{
 const docs=[
  {id:1,status:'DRAFT',warehouse_id:7,source_key:'so:1',usage_date:'2026-11-21',revision:2,created_by:'A',lines:[{item_name:'Kabel',sku:'PX-KB-200',qty_used:null,planned_qty:100}]},
  {id:2,status:'FINAL',warehouse_id:7,source_key:'so:1',usage_date:'2026-11-21',revision:3,created_by:'A',finalized_by:'B',lines:[{item_name:'CCTV',sku:'PX-CC-100',qty_used:2,planned_qty:3}]}
 ];
 const actual=[{usage_date:'2026-11-21',warehouse_id:7,source_key:'so:1',item_name:'CCTV',sku:'PX-CC-100',qty_used:2,unit:'pcs',actor_name:'B'}];
 const s=exp.usage(docs,actual,[base]);
 assert.deepEqual(s.map(x=>x.name),['Draft','Dokumen Final','Detail Draft dan Final','USED Final']);
 assert.equal(s[0].rows.length,1);
 assert.equal(s[1].rows.length,1);
 assert.equal(s[2].rows.length,2);
 assert.equal(s[2].rows[0]['Qty USED'],null);
 assert.equal(s[3].rows.length,1);
 assert.equal(s[3].rows[0]['Customer'],'PT Contoh');
 assert.equal(s[3].rows[0]['Qty USED'],2);
});
test('Daily Stock preserves invalid balances as blank numeric cells with reconciliation warning',()=>{
 const s=exp.daily({date:'2026-11-21',items:[{name:'Kabel',sku:'PX-001',opening:null,incoming:null,outgoing:null,closing:null,quality:'invalid_balance',warning:'Stok invalid'}]});
 assert.equal(s[0].rows[0]['Ending'],null);
 assert.equal(s[0].rows[0]['Status'],'Perlu rekonsiliasi');
});
test('Monthly OUT retains IN OUT USED separately',()=>{
 const s=exp.monthly({month:'2026-11',items:[{name:'Camera',sku:'PX-CC-100',incoming:10,outgoing:3,used:2,unit:'pcs'}]});
 assert.equal(s[0].rows[0]['OUT'],3);
 assert.equal(s[0].rows[0]['USED Final'],2);
});
test('Stock verification export calculates signed physical-versus-system difference',()=>{
 const s=exp.verification({rows:[{sku:'PX-001',item_name:'Kabel',system_qty:10,physical_qty:8,created_at:'2026-11-21'}]});
 assert.equal(s[0].rows[0]['Selisih'],-2);
});
test('XLSX workbook is generated with correct sheet names and date filename',()=>{
 const calls=[],xlsx={utils:{
  book_new:()=>({sheets:[]}),
  json_to_sheet:rows=>({'!ref':'A1:C2',rows}),
  book_append_sheet:(book,ws,name)=>{book.sheets.push({ws,name});calls.push({name,ws});}
 },writeFile:(book,filename)=>calls.push({filename,count:book.sheets.length})};
 exp.workbook(xlsx,[{name:'Pekerjaan',rows:[{SO:'SO-1'}]},{name:'Material',rows:[{SKU:'PX-1'}]}],'Warehouse_2026-11.xlsx');
 assert.equal(calls.at(-1).filename,'Warehouse_2026-11.xlsx');
 assert.equal(calls.at(-1).count,2);
 assert.deepEqual(calls.slice(0,2).map(x=>x.name),['Pekerjaan','Material']);
 assert.ok(calls[0].ws['!autofilter']);
});
test('Formula-like untrusted text is exported as inert text',()=>{
 const s=exp.materials([{...base,customer:'=HYPERLINK("evil","click")'}]);
 assert.equal(s[0].rows[0]['Customer'].startsWith("'="),true);
});
test('UI offers export on all Warehouse tabs, export dependency loaded before UI',()=>{
 assert.match(ui,/id="wh-export-excel"/);
 assert.match(ui,/exportWarehouseExcel/);
 for(const mode of ['materials','usage','daily','monthly','verify'])assert.match(ui,new RegExp("section==='"+mode+"'"));
 assert.ok(html.indexOf('/pxl-wh-0001i-export.js?v=PXL-WH-0001I')>0);
 assert.ok(html.indexOf('/pxl-wh-0001i-export.js')<html.indexOf('/pxl-wh-0001-ui.js?v=PXL-WH-0001I'));
});
