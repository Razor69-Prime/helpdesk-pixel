'use strict';

function assertVpsOnlyDatabase(url, appEnv = '') {
  const env = String(appEnv || '').trim().toLowerCase();
  if (env === 'staging') return true;

  const raw = String(url || '').trim();
  let host = '';
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    throw new Error('PXL-URG-0107D: Database REST URL production tidak valid.');
  }

  if (host === 'supabase.co' || host.endsWith('.supabase.co')) {
    throw new Error('PXL-URG-0107D: Production dilarang terhubung ke Supabase Cloud. Gunakan PostgREST VPS lokal.');
  }
  return true;
}

module.exports = { assertVpsOnlyDatabase };
