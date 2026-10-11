const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const {summarizeProjectMaterialLedger,checkProjectMaterialUsage}=require('../project-vnext-3c');

function route(method,url){
  const start=server.indexOf(`app.${method}('${url}'`); assert.notEqual(start,-1,`${method} ${url} missing`);
  const next=server.indexOf('\napp.',start+10); return server.slice(start,next<0?server.length:next);
}
function fn(name,nextName){
  const start=server.indexOf(`async function ${name}`); assert.notEqual(start,-1,`${name} missing`);
  const end=nextName?server.indexOf(`\nasync function ${nextName}`,start+10):-1;
  return server.slice(start,end<0?server.length:end);
}

test('checkProjectMaterialUsage allows within limit and blocks zero/no approval with detailed message',()=>{
  const ok=checkProjectMaterialUsage({itemName:'Kamera',mrApprovedQty:5,usageLimit:7,totalDone:6,requestedToday:1});
  assert.equal(ok.ok,true);
  assert.equal(ok.remaining_allowed,1);

  const blocked=checkProjectMaterialUsage({itemName:'Kamera',mrApprovedQty:5,usageLimit:7,totalDone:6,requestedToday:2});
  assert.equal(blocked.ok,false);
  assert.match(blocked.message,/Kamera/);
  assert.match(blocked.message,/MR Approved[^\d]*5/i);
  assert.match(blocked.message,/Total Done[^\d]*6/i);
  assert.match(blocked.message,/Today[^\d]*2/i);
  assert.match(blocked.message,/Sisa|remaining/i);

  const none=checkProjectMaterialUsage({itemName:'Kabel',mrApprovedQty:0,usageLimit:0,totalDone:0,requestedToday:1});
  assert.equal(none.ok,false);
});

test('override raises the same material usage limit but role alone does not',()=>{
  const before=summarizeProjectMaterialLedger({
    boqItemId:'boq-1',materialRequests:[{status:'approved',items:[{project_boq_item_id:'boq-1',qty_requested:2}]}],overrides:[],totalDone:2
  });
  assert.equal(checkProjectMaterialUsage({itemName:'Cam',mrApprovedQty:before.mr_approved_qty,usageLimit:before.usage_limit,totalDone:2,requestedToday:1}).ok,false);
  const after=summarizeProjectMaterialLedger({
    boqItemId:'boq-1',materialRequests:[{status:'approved',items:[{project_boq_item_id:'boq-1',qty_requested:2}]}],overrides:[{project_boq_item_id:'boq-1',qty:1}],totalDone:2
  });
  assert.equal(checkProjectMaterialUsage({itemName:'Cam',mrApprovedQty:after.mr_approved_qty,usageLimit:after.usage_limit,totalDone:2,requestedToday:1}).ok,true);
});

test('fresh material usage state reads Project MR, MR items, overrides, and achievements server-side',()=>{
  const body=fn('getFreshProjectMaterialUsageState','validateProjectMrBoqItems');
  assert.match(body,/db\.getProjectMaterialRequests\(item\.project_id\)/);
  assert.match(body,/db\.getProjectMaterialRequestItemsByRequestIds\(/);
  assert.match(body,/db\.getProjectMaterialOverrides\(\{itemId:item\.id\}\)/);
  assert.match(body,/db\.getProjectReportItemAchievements\(item\.id\)/);
  assert.match(body,/summarizeProjectMaterialLedger\(/);
  assert.doesNotMatch(body,/req\.body/);
});

test('Material POST enforces fresh MR Approved plus Override while Jasa keeps BOQ-only behavior',()=>{
  const r=route('post','/api/project-report-items/:id/achievements');
  assert.match(r,/category[^\n]*material/i);
  assert.match(r,/getFreshProjectMaterialUsageState\(item\)/);
  assert.match(r,/checkProjectMaterialUsage\(/);
  assert.match(r,/status\(400\)[\s\S]*usage\.message/);
  assert.match(r,/Achievement melebihi remain item/);
  assert.doesNotMatch(r,/req\.body\.(mr_approved_qty|override_qty|usage_limit|available_for_use)/);
});

test('Material PATCH blocks only increases that exceed fresh limit and allows downward or note-only legacy correction',()=>{
  const r=route('patch','/api/project-report-item-achievements/:id');
  assert.match(r,/getFreshProjectMaterialUsageState\(item\)/);
  assert.match(r,/proposedTotal/);
  assert.match(r,/currentTotal/);
  assert.match(r,/proposedTotal>currentTotal/);
  assert.match(r,/checkProjectMaterialUsage\(/);
  assert.doesNotMatch(r,/req\.body\.(mr_approved_qty|override_qty|usage_limit|available_for_use)/);
});
