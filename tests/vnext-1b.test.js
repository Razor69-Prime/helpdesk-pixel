const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const crm = fs.readFileSync(path.join(root, 'public/crm.html'), 'utf8');

test('backend exposes protected bulk customer classification endpoint', () => {
  assert.match(server, /\/api\/crm\/customers\/bulk-classification/);
  assert.match(server, /customer_segment_bulk_manage/);
});

test('CRM provides bulk classification selection, preview, and confirm UI', () => {
  assert.match(crm, /id="bulkClassificationPanel"/);
  assert.match(crm, /function previewBulkClassification\(/);
  assert.match(crm, /function confirmBulkClassification\(/);
});
