const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const crm = fs.readFileSync(path.join(root, 'public/crm.html'), 'utf8');

test('backend allows expanded B2B and B2C sectors', () => {
  assert.match(server, /B2B:\['Pemerintahan','Swasta','Retail','Corporate'\]/);
  assert.match(server, /B2C:\['End User','Hospitality'\]/);
  assert.doesNotMatch(server, /if\(seg==='B2C'\) sector='End User'/);
});

test('CRM sector selectors expose expanded sector choices', () => {
  assert.match(crm, /\['Pemerintahan','Swasta','Retail','Corporate'\]/);
  assert.match(crm, /\['End User','Hospitality'\]/);
  assert.match(crm, /cSector\.disabled=seg==='Unclassified'/);
  assert.match(crm, /bulkSector\.disabled=seg==='Unclassified'/);
});
