const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

const modPath=path.join(root,'pxl-urg-0119-pr-project-performance.js');

test('PR compact list preserves list/search math fields but strips heavy item metadata',()=>{
  const mod=require(modPath);
  const rows=mod.compactPrRows([{id:'pr1',pr_number:'PR-1',items:[{
    desc:'Camera',qty:2,price:100,unit:'pcs',inventory_status:'pending_registration',
    supplier_phone:'08123',source_key:'VERY-LONG',inventory_item_id:'uuid',supplier_id:'sup'
  }]}]);
  assert.equal(rows[0].items.length,1);
  assert.equal(rows[0].items.reduce((sum,item)=>sum+(Number(item.qty||0)*Number(item.price||0)),0),200);
  assert.equal(rows[0].items.filter(item=>item.inventory_status==='pending_registration').length,1);
  assert.match(JSON.stringify(rows[0]).toLowerCase(),/camera/);
  assert.equal(rows[0].items[0].supplier_phone,undefined);
});

test('light project summary matches material/jasa and overall progress without MR ledger inputs',()=>{
  const mod=require(modPath);
  const rows=mod.buildLightProjectSummaries({
    projects:[{id:'p1',nama_project:'X'}],
    reports:[],legacyAchievements:[],
    items:[
      {id:'m1',project_id:'p1',category:'Material',boq_qty:10},
      {id:'j1',project_id:'p1',category:'Jasa',boq_qty:4}
    ],
    itemAchievements:[
      {item_id:'m1',achievement:5,achievement_date:'2026-11-03'},
      {item_id:'j1',achievement:1,achievement_date:'2026-11-03'}
    ],today:'2026-11-03'
  });
  assert.equal(rows[0].material_summary.progress,50);
  assert.equal(rows[0].jasa_summary.progress,25);
  assert.equal(rows[0].progress,42.86);
  assert.equal(rows[0].items,undefined);
  assert.equal(rows[0].achievements,undefined);
});

test('frontend loader hydrates PR detail only for Edit/PDF and backend is wired from config',()=>{
  const front=fs.readFileSync(path.join(root,'public/pxl-urg-0119-pr-project-performance.js'),'utf8');
  const config=fs.readFileSync(path.join(root,'config.js'),'utf8');
  assert.ok(front.includes("'/purchase-requests/'+encodeURIComponent(id)"));
  assert.match(front,/window\.editPR/);
  assert.match(front,/window\.exportPRPDF/);
  assert.match(config,/require\('\.\/pxl-urg-0119-pr-project-performance'\)/);
});