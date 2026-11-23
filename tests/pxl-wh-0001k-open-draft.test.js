'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../public/pxl-wh-0001-ui.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const open=ui.split(' const openDocument=doc=>{')[1].split(' const load=async()=>{')[0];
test('open draft restores document without overwriting it through new-job autofill',()=>{
 assert.match(open,/selectedJob=rec/);
 assert.match(open,/editingDoc=doc;dirty=false/);
 assert.match(open,/draftLines=\(doc\.lines\|\|\[\]\)\.map/);
 assert.doesNotMatch(open,/selectJob\(rec\)/);
 assert.doesNotMatch(open,/onJobSelected\(\)/);
});
test('Buka/Revisi navigates visibly to form and announces editing draft id',()=>{
 assert.match(ui,/id="wh-used-editor"/);
 assert.match(open,/editor\.scrollIntoView\(\{behavior:'smooth',block:'start'\}\)/);
 assert.match(open,/focus\(\{preventScroll:true\}\)/);
 assert.match(open,/Draft #'.*?' berhasil dibuka/);
 assert.match(ui,/Sedang .*?'mengedit DRAFT'/);
});
test('only one unsaved change confirmation for opening another document',()=>{
 assert.match(ui,/if\(doc&&\(!dirty\|\|confirm\('Perubahan yang belum disimpan/);
 assert.doesNotMatch(open,/confirm\(/);
});
test('draft and finalize remain distinct, no inventory stock mutation',()=>{
 assert.match(ui,/Simpan Semua sebagai Draft/);
 assert.match(ui,/Finalisasi Pemakaian/);
 assert.match(ui,/Kosongkan Qty/);
 assert.match(ui,/daily-usage\/drafts\/'.*?\/finalize/);
 assert.match(html,/pxl-wh-0001-ui\.js\?v=PXL-WH-0001L/);
});
