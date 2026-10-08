const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const so=fs.readFileSync(path.join(root,'public/sales-order.html'),'utf8');
const migrationPath=path.join(root,'PXL-VNEXT-2C-MIGRATION.sql');

test('2C migration adds manual WO location, survey snapshot, cancel audit and survey SO link',()=>{
  assert.equal(fs.existsSync(migrationPath),true);
  const sql=fs.readFileSync(migrationPath,'utf8');
  for(const token of ['google_maps_url','survey_status','survey_materials','survey_services','survey_completed_at','survey_completed_by','survey_sales_order_id','cancelled_at','cancelled_by','cancel_reason','survey_source_ticket_id','survey_source_wo_number']) assert.match(sql,new RegExp(token));
});

test('Input WO manual uses explicit Survey Operasional Project type and Google Maps without inline survey report fields',()=>{
  assert.match(index,/id="f-work-order-type"/);
  assert.match(index,/value="Survey"/);
  assert.match(index,/value="Operasional"/);
  assert.match(index,/value="Project"/);
  assert.match(index,/id="f-google-maps-url"/);
  assert.match(index,/work_order_type:selectedWorkOrderType/);
  assert.match(index,/google_maps_url:/);
  assert.doesNotMatch(index,/id="f-survey-fields"/);
});

test('manual ticket backend accepts explicit WO type for manual source and stores Google Maps',()=>{
  assert.match(server,/MANUAL_WORK_ORDER_TYPES/);
  assert.match(server,/requestedWorkOrderType/);
  assert.match(server,/sourceType\s*===\s*['"]manual['"]/);
  assert.match(server,/google_maps_url/);
});

test('survey report endpoint is manual Survey only and strips pricing from technician report',()=>{
  assert.match(server,/\/api\/tickets\/:id\/survey-report/);
  assert.match(server,/work_order_type.*Survey/s);
  assert.match(server,/source_type.*manual/s);
  assert.match(server,/sanitizeSurveyLines/);
  assert.match(server,/survey_materials/);
  assert.match(server,/survey_services/);
  assert.doesNotMatch(server,/survey_materials[^\n]*unit_price/);
});

test('survey to SO draft uses existing sales_order_create_wo permission and actual SO submission links source ticket',()=>{
  assert.match(server,/survey-sales-order-draft/);
  assert.match(server,/requireSalesOrderPermission\(['"]sales_order_create_wo['"]\)/);
  assert.match(server,/survey_source_ticket_id/);
  assert.match(server,/survey_sales_order_id/);
  assert.match(so,/pxl-vnext-2c-survey-so-prefill\.js/);
});

test('WO list supports type filter and cancel keeps record with audit fields',()=>{
  assert.match(index,/id="t-work-order-type"/);
  assert.match(index,/work_order_type/);
  assert.match(server,/\/api\/tickets\/:id\/cancel/);
  assert.match(server,/cancel_reason/);
  assert.match(server,/status:\s*['"]cancelled['"]/);
  assert.match(index,/Cancelled/);
});

test('WO renderer declares isManualSurvey before any survey action uses it',()=>{
  const decl=index.indexOf('const isManualSurvey=');
  const use=index.indexOf('const surveyResultBtn=isManualSurvey');
  assert.ok(decl>=0&&use>=0&&decl<use,'isManualSurvey must be initialized before survey action buttons are built');
});

test('existing SO to WO and MR routes remain present',()=>{
  assert.match(server,/app\.post\(['"]\/api\/sales-orders\/:id\/work-order['"]/);
  assert.match(server,/integrationKey=`sales-order:\$\{so\.id\}`/);
  assert.match(server,/source_type:['"]sales_order['"]/);
  assert.match(server,/app\.post\(['"]\/api\/sales-orders\/:id\/material-request['"]/);
});
