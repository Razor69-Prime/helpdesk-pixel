'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../public/pxl-wh-0001-ui.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
test('MR UUIDs are retained in model but never shown as the MR label in Warehouse table',()=>{
 assert.match(ui,/const mrSummary=record=>/);
 assert.match(ui,/count\+' MR'/);
 assert.match(ui,/esc\(mrSummary\(r\)\)/);
 assert.doesNotMatch(ui,/esc\(r\.mr_numbers\.join\(', '\)/);
 assert.match(ui,/Form MR/);
});
test('daily draft list shows customer and technician from existing linked SO-WO model',()=>{
 assert.match(ui,/table\(\['Dokumen','SO \/ WO','Customer','Teknisi','Status','Revisi','Item','Aksi'\]/);
 assert.match(ui,/\.customer\|\|'-'/);
 assert.match(ui,/technicianSummary\(work\.find\(r=>r\.source_key===doc\.source_key\)\|\|\{\}\)/);
 assert.match(ui,/colspan="8">Belum ada draft/);
});
test('frontend cache revision updated without changing Warehouse API',()=>{
 assert.match(html,/pxl-wh-0001-ui\.js\?v=PXL-WH-0001K/);
});
