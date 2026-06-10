# Sales Visits — Struktur Database

## File: data/sales_visits.json
## Format: Array of visit objects

### Schema per visit:

```json
{
  "id": "uuid",                        // auto-generate
  "created_at": "ISO datetime",        // auto saat simpan

  // ── Identitas Sales ──
  "sales_pic": "string",               // dari login user, tidak bisa diedit
  "sales_user_id": "string",           // id user yang login

  // ── Data Customer / Toko ──
  "customer_name": "string",           // nama toko / perusahaan
  "customer_phone": "string",          // no telp (clickable → wa.me)
  "address": "string",                 // alamat lengkap

  // ── Lokasi GPS ──
  "lat": "number | null",              // latitude saat kunjungan (auto capture atau manual)
  "lng": "number | null",              // longitude saat kunjungan
  "location_manual": "boolean",        // true = diisi manual, false = dari GPS
  "location_label": "string | null",   // label manual jika diisi tangan

  // ── Omzet ──
  "estimasi_omzet": "number | null",   // estimasi omzet (Rupiah)
  "realisasi_omzet": "number | null",  // realisasi omzet aktual (Rupiah)

  // ── Status Pipeline ──
  "status": "string",
  // nilai: prospect | follow_up_1 | follow_up_2 | last_follow | closed_won | closed_lost

  // ── Tanggal Pipeline (auto-hitung dari prospect_date) ──
  "prospect_date": "YYYY-MM-DD",       // tanggal kunjungan pertama / prospect
  "follow_up_1_date": "YYYY-MM-DD",    // prospect_date + 3 hari (auto)
  "follow_up_2_date": "YYYY-MM-DD",    // follow_up_1_date + 3 hari (auto)
  "last_follow_date": "YYYY-MM-DD",    // follow_up_2_date + 7 hari (auto)

  // ── Catatan ──
  "notes": "string | null",            // catatan bebas per kunjungan
  "updated_at": "ISO datetime"         // terakhir diupdate
}
```

### Contoh data:

```json
{
  "id": "sv-001",
  "created_at": "2026-06-10T08:00:00.000Z",

  "sales_pic": "Budi Sales",
  "sales_user_id": "u7",

  "customer_name": "Toko Elektronik Maju",
  "customer_phone": "081234567890",
  "address": "Jl. Sunset Road No. 88, Kuta, Badung, Bali",

  "lat": -8.712345,
  "lng": 115.167890,
  "location_manual": false,
  "location_label": null,

  "estimasi_omzet": 15000000,
  "realisasi_omzet": null,

  "status": "follow_up_1",

  "prospect_date":    "2026-06-10",
  "follow_up_1_date": "2026-06-13",
  "follow_up_2_date": "2026-06-16",
  "last_follow_date": "2026-06-23",

  "notes": "Customer tertarik paket CCTV 8 channel. Minta penawaran harga.",
  "updated_at": "2026-06-10T08:30:00.000Z"
}
```

### Aturan bisnis:
- follow_up_1_date  = prospect_date + 3 hari
- follow_up_2_date  = follow_up_1_date + 3 hari  (= prospect + 6)
- last_follow_date  = follow_up_2_date + 7 hari  (= prospect + 13)
- sales_pic diambil dari session login, readonly
- customer_phone → format wa.me/62xxx (strip leading 0, tambah 62)
- lat/lng: auto GPS saat submit, bisa override manual
- status bergerak maju sesuai pipeline, tidak bisa mundur (kecuali admin/superadmin)

### Status pipeline:
| Status       | Label            | Keterangan                        |
|--------------|------------------|-----------------------------------|
| prospect     | 🎯 Prospect      | Kunjungan pertama                 |
| follow_up_1  | 📞 Follow Up 1   | 3 hari setelah prospect           |
| follow_up_2  | 📞 Follow Up 2   | 3 hari setelah follow up 1        |
| last_follow  | 🔔 Last Follow   | 7 hari setelah follow up 2        |
| closed_won   | ✅ Closed Won    | Deal berhasil                     |
| closed_lost  | ❌ Closed Lost   | Deal gagal                        |
