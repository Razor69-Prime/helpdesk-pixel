# PXL-URG-0107E — Rename Config Runtime to PostgREST

Tujuan: menjadikan nama runtime utama sesuai arsitektur VPS lokal tanpa memutus compatibility wrapper lama.

Perubahan:
- Config canonical: `POSTGREST_URL`, `POSTGREST_KEY`.
- Env canonical: `POSTGREST_URL`, `POSTGREST_KEY`.
- Env lama `SUPABASE_URL` / `SUPABASE_KEY` tetap menjadi fallback sementara.
- `db-core.js`: `USE_POSTGREST` + `restFetch`.
- `db.js`: memakai canonical PostgREST runtime.
- `server.js`: memakai `db.USE_POSTGREST` dan `cfg.POSTGREST_URL` untuk production.
- Alias `USE_SUPABASE` tetap diexport sementara agar wrapper legacy tidak rusak.

Tidak ada perubahan schema/database dan tidak ada migrasi data pada fase ini.

Uji:
```bash
node ops/audit/test-postgrest-runtime-config.js
node ops/audit/test-vps-supabase-guard.js
```

Expected:
- `PASS PXL-URG-0107E`
- `PASS PXL-URG-0107D`
