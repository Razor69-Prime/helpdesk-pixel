const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const so = fs.readFileSync(path.join(root, 'public/sales-order.html'), 'utf8');
const project = fs.readFileSync(path.join(root, 'public/pxl-prod-0022ab-sales-order-sites.js'), 'utf8');
const migrationPath = path.join(root, 'PXL-VNEXT-1C1-MIGRATION.sql');

test('1C1 migration adds customer source snapshot without rewriting old SO', () => {
  assert.ok(fs.existsSync(migrationPath));
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(sql, /add column if not exists customer_source text/i);
  assert.doesNotMatch(sql, /update\s+sales_orders\s+set\s+customer_source/i);
});

test('SO source options include Meta Ads and approved channels', () => {
  assert.match(so, /id="customerSource"/);
  for (const label of ['Meta Ads','Organic','Referral','Walk In','Existing Customer','Lainnya']) assert.match(so, new RegExp(label));
  assert.match(so, /B2C.*Sumber Customer wajib dipilih|Sumber Customer wajib dipilih.*B2C/s);
  assert.match(so, /customer_source:/);
  assert.match(project, /customer_source:/);
});

test('backend validates customer source and requires it for B2C', () => {
  assert.match(server, /CUSTOMER_SOURCE_OPTIONS/);
  assert.match(server, /Meta Ads/);
  assert.match(server, /customer_source/);
  assert.match(server, /B2C.*Sumber Customer wajib dipilih|Sumber Customer wajib dipilih.*B2C/s);
});
