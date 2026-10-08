const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const index=fs.readFileSync('public/index.html','utf8');
const start=index.indexOf('function renderTickets(){');
const end=index.indexOf('\n}\n\n\n\n/* ══ PXL-REV-0064',start);
const block=index.slice(start,end);

test('Daftar Tiket renders Remarks button natively without delayed injector dependency',()=>{
  assert.match(block,/const canEditRemarks=/);
  assert.match(block,/const remarksBtn=/);
  assert.match(block,/pxl-native-remarks-btn/);
  assert.match(block,/data-ticket-id="\$\{t\.id\}"/);
  const remarksBtnPos=block.indexOf('${remarksBtn}');
  const actionsEnd=block.indexOf('</div>\n      </div>',block.indexOf('<div class="ticket-actions">'));
  assert.ok(remarksBtnPos>=0 && remarksBtnPos<actionsEnd,'native remarks button must be emitted inside ticket-actions');
});
