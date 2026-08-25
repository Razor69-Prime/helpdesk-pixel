// ═══════════════════════════════════════════════════════════
//  KONFIGURASI — isi bagian ini sebelum deploy
//  Dapatkan nilai dari: https://supabase.com → Settings → API
// ═══════════════════════════════════════════════════════════

// PXL-AI-0005A — Gemini health wrapper only; no business data is sent.
require('./pxl-ai-0005a');
// Urutan wrapper penting: akses Inventory MR 0004E, pencarian 0004D,
// formula qty 0004F, integrasi 0004C, reminder 0004B, hardening SO 0004A.
require('./pxl-stg-0004e');
require('./pxl-stg-0004d');
require('./pxl-stg-0004f');
require('./pxl-urg-0012-superadmin-boq');
require('./pxl-stg-0004c');
require('./pxl-stg-0004b');
require('./pxl-stg-0004a');

module.exports = {

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://chgcictuycjeqdxfrnej.supabase.co',
  SUPABASE_KEY: process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInR5cCI6IkpXVCJ9',

  // Database URL untuk session store (Supabase → Settings → Database → URI)
  DATABASE_URL: process.env.DATABASE_URL || null,

  // Session secret
  SESSION_SECRET: process.env.SESSION_SECRET || 'pixel-helpdesk-2026-secret',

  // Port lokal
  PORT: process.env.PORT || 3000,

  // Link tracking aktif berapa hari
  TRACK_DAYS: 14,

};

// ═══════════════════════════════════════════════════════════
//  CARA ISI:
//  Lokal  → edit langsung nilai di atas
//  Vercel → set di dashboard: Settings → Environment Variables
//           SUPABASE_URL = https://chgcictuycjeqdxfrnej.supabase.co
//           SUPABASE_KEY = [set via environment]
//           SESSION_SECRET = pixel-helpdesk-2026-secret
// ═══════════════════════════════════════════════════════════
