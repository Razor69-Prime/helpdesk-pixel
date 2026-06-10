// ═══════════════════════════════════════════════════════════
//  KONFIGURASI — isi bagian ini sebelum deploy
//  Dapatkan nilai dari: https://supabase.com → Settings → API
// ═══════════════════════════════════════════════════════════

module.exports = {

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://chgcictuycjeqdxfrnej.supabase.co',
  SUPABASE_KEY: process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZ2NpY3R1eWNqZXFkeGZybmVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzA4MDIsImV4cCI6MjA5NjY0NjgwMn0.3vdiX3Eya1l1CON47m3htPKl7GsYF4PmQ9eyQgBHE-Q',

  // Session secret (ganti dengan string random panjang)
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
