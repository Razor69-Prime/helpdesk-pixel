const assert = require('assert');
const fs = require('fs');
const path = require('path');

const guard = require('../../pxl-urg-0107d-vps-guard');
const server = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

assert.doesNotThrow(() => guard.assertVpsOnlyDatabase('http://127.0.0.1:3003', 'production'));
assert.doesNotThrow(() => guard.assertVpsOnlyDatabase('http://localhost:3003', 'production'));
assert.throws(
  () => guard.assertVpsOnlyDatabase('https://abcxyz.supabase.co', 'production'),
  /PXL-URG-0107D/
);
assert.throws(
  () => guard.assertVpsOnlyDatabase('https://abcxyz.supabase.co/rest/v1', ''),
  /PXL-URG-0107D/
);
assert.doesNotThrow(() => guard.assertVpsOnlyDatabase('https://staging-ref.supabase.co', 'staging'));

assert(server.includes("require('./pxl-urg-0107d-vps-guard')"));
assert(server.includes("assertVpsOnlyDatabase(cfg.SUPABASE_URL, APP_ENV)"));

console.log('PASS PXL-URG-0107D');
