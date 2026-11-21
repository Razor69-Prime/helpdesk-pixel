'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.resolve(__dirname,'../public/pxl-wh-0001-ui.js'),'utf8');
const html=fs.readFileSync(path.resolve(__dirname,'../public/index.html'),'utf8');
const usage=ui.slice(ui.indexOf('async function renderUsage(){'),ui.indexOf('async function renderDaily(){'));
test('SO/WO picker has fast text search, no native select',()=>{
 assert.match(usage,/id="wh-used-wo" type="search"/);
 assert.doesNotMatch(usage,/<select id="wh-used-wo"/);
 assert.match(usage,/jobSearchText=r=>\[r\.so_number,r\.wo_number,r\.wh_number,r\.customer,r\.job/);
 assert.match(usage,/\.slice\(0,35\)/);
});
test('only result click/keyboard confirms a source key; typing clears it',()=>{
 assert.match(usage,/let selectedJob=null/);
 assert.match(usage,/sourcePicker\.oninput=\(\)=>\{selectedJob=null/);
 assert.match(usage,/const rec=selectedJob,key=rec\?\.source_key/);
 assert.match(usage,/sourcePicker\.onkeydown=event/);
 assert.match(usage,/ArrowDown/);
 assert.match(usage,/ArrowUp/);
 assert.match(usage,/Escape/);
 assert.match(usage,/Enter/);
});
test('autofill remains connected to confirmed SO or WO',()=>{
 assert.match(usage,/const selectJob=r=>\{/);
 assert.match(usage,/onJobSelected\(\)/);
 assert.match(usage,/const record=selectedJob/);
 assert.match(usage,/matcher\?\.proposals\(record,inventory\)/);
 assert.match(usage,/data-wh-proposal/);
});
test('Warehouse UI version bumped to avoid stale browser cache',()=>{
 assert.match(html,/pxl-wh-0001-ui\.js\?v=PXL-WH-0001E/);
});
