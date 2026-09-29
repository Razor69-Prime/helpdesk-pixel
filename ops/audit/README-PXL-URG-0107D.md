# PXL-URG-0107D — Outbound Supabase Guard

Tujuan: mencegah production PixelApps kembali terhubung ke Supabase Cloud karena salah environment/config.

Perubahan:
- Production memvalidasi endpoint database saat startup.
- Host `supabase.co` dan seluruh subdomain `*.supabase.co` ditolak.
- Endpoint VPS lokal seperti `127.0.0.1:3003` dan `localhost:3003` tetap diizinkan.
- Guard lama untuk environment staging tidak diubah pada fase ini.
- Tidak ada perubahan schema atau data database.

Jika production salah dikonfigurasi ke Supabase Cloud, Node akan gagal startup dengan error `PXL-URG-0107D` daripada diam-diam memakai cloud.

Uji:
```bash
node ops/audit/test-vps-supabase-guard.js
```

Expected: `PASS PXL-URG-0107D`.
