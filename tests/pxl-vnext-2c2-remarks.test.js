const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const index=fs.readFileSync('public/index.html','utf8');

test('Daftar Tiket renders technician remarks natively before ticket meta',()=>{
  const renderStart=index.indexOf('function renderTickets(){');
  assert.ok(renderStart>=0,'renderTickets must exist');
  const renderEnd=index.indexOf('/* ══ PXL-REV-0064',renderStart);
  const block=index.slice(renderStart,renderEnd);
  assert.match(block,/technician_remarks/,'renderTickets must use technician_remarks directly');
  assert.match(block,/pxl-native-remarks-inline/,'renderTickets must emit the remarks inline element natively');
  const remarksPos=block.indexOf('pxl-native-remarks-inline');
  const metaPos=block.indexOf('<div class="ticket-meta">');
  assert.ok(remarksPos>=0&&metaPos>=0&&remarksPos<metaPos,'remarks should render before ticket meta');
});
