const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const server=fs.readFileSync('server.js','utf8');
const index=fs.readFileSync('public/index.html','utf8');
const renderStart=index.indexOf('function renderTickets(){');
const renderEnd=index.indexOf('\n}\n\n\n\n/* ══ PXL-REV-0064',renderStart);
const renderBlock=index.slice(renderStart,renderEnd);
test('ticket list API strips large signature blobs from normal list payload',()=>{
  assert.match(server,/function compactTicketForList\(/); assert.match(server,/delete row\.tech_signature/); assert.match(server,/delete row\.customer_signature/); assert.match(server,/compactTicketForList\(t\)/);
});
test('Daftar Tiket renders at most 25 WO cards per page',()=>{
  assert.match(index,/const TICKET_LIST_PAGE_SIZE=25/); assert.match(index,/let ticketListPage=1/); assert.match(renderBlock,/filteredData/); assert.match(renderBlock,/\.slice\(pageStart,pageStart\+TICKET_LIST_PAGE_SIZE\)/); assert.match(renderBlock,/changeTicketListPage/); assert.match(renderBlock,/Halaman/);
});
test('ticket filters reset pagination to page one',()=>{
  assert.match(index,/function resetTicketListPage\(\)/); assert.match(index,/id="t-search"[^>]+oninput="resetTicketListPage\(\)"/); assert.match(index,/id="t-status"[^>]+onchange="resetTicketListPage\(\)"/); assert.match(index,/id="t-work-order-type"[^>]+onchange="resetTicketListPage\(\)"/); assert.match(index,/if\(ctx==='t'\)\{ticketListPage=1;renderTickets\(\);\}/);
});
