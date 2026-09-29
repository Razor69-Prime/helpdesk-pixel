// ═══════════════════════════════════════════════════════════
//  KONFIGURASI — isi bagian ini sebelum deploy
//  Dapatkan nilai dari: https://supabase.com → Settings → API
// ═══════════════════════════════════════════════════════════

// PXL-AI-0005A — Gemini health wrapper only; no business data is sent.
require('./pxl-ai-0005a');
// PXL-URG-0035 — isolated Manager/Superadmin WO date editor guard.
require('./pxl-urg-0035-wo-date-edit');
// PXL-URG-0036 — isolated Sales Order Excel parser/template routes.
require('./pxl-urg-0036-so-excel-import');
// PXL-URG-0037 — backend Purchase Request permission bridge from Manajemen Akun pr_roles.
require('./pxl-urg-0037-pr-permission-fix');
// PXL-URG-0040A — guaranteed isolated Master Pricelist frontend bootstrap.
require('./pxl-urg-0040a-master-pricelist-loader');
// PXL-URG-0041 — isolated Material Request mobile readability UI only.
require('./pxl-urg-0041-material-request-mobile-loader');
// Urutan wrapper penting: akses Inventory MR 0004E, pencarian 0004D,
// formula qty 0004F, integrasi 0004C, reminder 0004B, hardening SO 0004A.
require('./pxl-stg-0004e');
require('./pxl-stg-0004d');
require('./pxl-stg-0004f');
require('./pxl-urg-0012-superadmin-boq');
require('./pxl-stg-0004c');
require('./pxl-stg-0004b');
require('./pxl-stg-0004a');

const POSTGREST_URL = process.env.POSTGREST_URL || process.env.SUPABASE_URL || 'http://127.0.0.1:3003';
const POSTGREST_KEY = process.env.POSTGREST_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'local-compat-key';

module.exports = {

  // PXL-URG-0107E — canonical runtime names for VPS local PostgREST.
  POSTGREST_URL,
  POSTGREST_KEY,

  // Backward-compatible aliases for legacy wrappers; remove in a later cleanup phase.
  SUPABASE_URL: POSTGREST_URL,
  SUPABASE_KEY: POSTGREST_KEY,

  // Optional database URL override
  DATABASE_URL: process.env.DATABASE_URL || null,

  // Session secret
  SESSION_SECRET: process.env.SESSION_SECRET || 'pixel-helpdesk-2026-secret',

  // Port lokal
  PORT: process.env.PORT || 3000,

  // Link tracking aktif berapa hari
  TRACK_DAYS: 14,

};

// ═══════════════════════════════════════════════════════════
//  Production Supervisor:
//  POSTGREST_URL = http://127.0.0.1:3003
//  POSTGREST_KEY = local compatibility key
//  Legacy SUPABASE_* aliases remain temporarily for adapter compatibility.
// ═══════════════════════════════════════════════════════════