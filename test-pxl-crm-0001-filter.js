'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('public/crm.html','utf8');
const js=html.split('<script>')[1].split('</script>')[0];new vm.Script(js);
for(const id of ['crmCustomerSearch','crmCustomerPic','crmCustomerType','crmCustomerSegment','crmCustomerSector','crmCustomerSort','crmCustomerFilterCount'])assert(html.includes('id="'+id+'"'));
assert(html.includes('onchange="renderCustomerTable()"'));
assert(html.includes('oninput="renderCustomerTable()"'));
assert(html.includes('function renderCustomerTable()'));
assert(html.includes('refreshCrmCustomerFilterOptions();renderCustomerTable();'));
assert(html.includes('customerRows.innerHTML=visible.map('));
assert(html.includes('<th>Segment</th><th>Sector</th>'));
assert(html.includes("<td>${esc(c.market_segment||'Unclassified')}</td><td>${esc(c.sector||'-')}</td>"));
assert(html.includes('for(const c of getFilteredCrmCustomers())'));
assert(html.includes('function exportCustomerClassification()'));
assert(html.includes('function previewBulkClassification()'));
assert(html.includes('function confirmBulkClassification()'));
const subset=js.slice(js.indexOf('function crmCustomerNorm('),js.indexOf('function resetCrmCustomerFilters('));
const all={
 crmCustomerSearch:{value:''},crmCustomerPic:{value:''},crmCustomerType:{value:''},crmCustomerSegment:{value:''},crmCustomerSector:{value:''},crmCustomerSort:{value:'name:asc'}
};
const people=[
{id:'1',name:'ADI Elektro',sales_pic:'Dewa',type:'B2B',market_segment:'B2B',sector:'Retail',phone:'0812'},
{id:'2',name:'AG Komputer',sales_pic:'Reya',type:'B2B',market_segment:'B2B',sector:'Corporate',phone:'0851'},
{id:'3',name:'Dr. Wilson',sales_pic:'Eka',type:'B2C',market_segment:'B2C',sector:'End User',phone:'0877'},
{id:'4',name:'Another Shop',sales_pic:'Dewa',type:'B2B',market_segment:'B2B',sector:'Retail',phone:'0899'}
];
const sandbox={D:{customers:people},document:{getElementById:id=>all[id]||null},Set,Array,String,Number,Intl,console};vm.createContext(sandbox);
vm.runInContext(subset+';globalThis.testFilter=getFilteredCrmCustomers',sandbox);
const f=()=>Array.from(sandbox.testFilter(),x=>x.id);
assert.deepEqual(f(),['1','2','4','3']);
all.crmCustomerPic.value='Dewa';assert.deepEqual(f(),['1','4']);
all.crmCustomerSector.value='Retail';assert.deepEqual(f(),['1','4']);
all.crmCustomerSearch.value='0899';assert.deepEqual(f(),['4']);
all.crmCustomerSearch.value='';all.crmCustomerSort.value='name:desc';assert.deepEqual(f(),['4','1']);
all.crmCustomerPic.value='';all.crmCustomerSector.value='';all.crmCustomerSegment.value='B2C';assert.deepEqual(f(),['3']);
assert.equal(people.length,4);
console.log('PASS CRM-0001 filter combo, phone search, sorting, read-only, exact bulk selection scope, export preserved');
