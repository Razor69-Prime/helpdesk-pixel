// ═══════════════════════════════════════════════════════════
//  KONFIGURASI — isi bagian ini sebelum deploy
//  Dapatkan nilai dari: https://supabase.com → Settings → API
// ═══════════════════════════════════════════════════════════

// Urutan wrapper penting: integrasi Form MR didaftarkan paling awal,
// lalu reminder/verifikasi 0004B dan hardening SO 0004A.
require('./pxl-stg-0004c');
require('./pxl-stg-0004b');
require('./pxl-stg-0004a');

module.exports = {

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://chgcictuycjeqdxfrnej.supabase.co',
  SUPABASE_KEY: process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYXNlIiwicmVmIjoiY2hnY2ljdHV5Y2plcWR4ZnJuZWoiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4MTA3MDgwMiwiZXhwIjoyMDk2NjQ2ODAyfQ.3vdiX3Eya1l1CON47m3htPKl7GsYF4PmQ9eyQgBHE-Q',

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
//           SUPABASE_KEY = eyJhbGci...
//           SESSION_SECRET = pixel-helpdesk-2026-secret
// ═══════════════════════════════════════════════════════════
