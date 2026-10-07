const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const so = fs.readFileSync(path.join(root, 'public/sales-order.html'), 'utf8');
const migrationPath = path.join(root, 'PXL-VNEXT-1C-MIGRATION.sql');

test('1C migration adds SO market snapshot columns without overwriting legacy data', () => {
  assert.ok(fs.existsSync(migrationPath));
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(sql, /add column if not exists market_segment text/i);
  assert.match(sql, /add column if not exists sector text/i);
  assert.doesNotMatch(sql, /update\s+sales_orders\s+set\s+market_segment/i);
});

test('SO backend exposes CRM customer classification and validates snapshot', () => {
  assert.match(server, /customers:\s*crmCustomers/i);
  assert.match(server, /market_segment/);
  assert.match(server, /B2B:\['Pemerintahan','Swasta','Retail','Corporate'\]/);
  assert.match(server, /B2C:\['End User','Hospitality'\]/);
  assert.match(server, /Market Segment wajib dipilih/);
});

test('SO form requires B2B B2C and aligned sector selection', () => {
  assert.match(so, /id="marketSegment"/);
  assert.match(so, /id="sector"/);
  assert.match(so, /<option value="B2B">B2B<\/option>/);
  assert.match(so, /<option value="B2C">B2C<\/option>/);
  assert.match(so, /Pemerintahan/);
  assert.match(so, /Hospitality/);
  assert.match(so, /customer_id:/);
  assert.match(so, /market_segment:/);
  assert.match(so, /sector:/);
});
