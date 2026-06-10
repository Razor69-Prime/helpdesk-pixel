# Helpdesk Teknisi v5 — Pixel Solusindo

## Jalankan Lokal (tanpa konfigurasi apapun)

```cmd
cd C:\Users\ASUSvivobook\helpdesk-pixel
npm install
npm start
```

Buka: http://localhost:3000
Data disimpan lokal di `data/tickets.json`

---

## Deploy Online ke Vercel + Supabase

### Step 1 — Setup Supabase
1. Login https://supabase.com → buka project
2. SQL Editor → paste `supabase-schema.sql` → Run
3. Settings → API → salin Project URL dan anon key

### Step 2 — Isi config.js
```js
SUPABASE_URL: 'https://xxxx.supabase.co',
SUPABASE_KEY: 'eyJhbGci...',
```

### Step 3 — Deploy ke Vercel
Upload folder ini ke vercel.com/new, set env vars:
- SUPABASE_URL
- SUPABASE_KEY  
- SESSION_SECRET (string random panjang)

---

## User Default

| Username  | Password  | Role      |
|-----------|-----------|-----------|
| andi      | andi123   | Teknisi   |
| budi      | budi123   | Teknisi   |
| citra     | citra123  | Teknisi   |
| doni      | doni123   | Teknisi   |
| admin     | admin888  | Admin     |
| akunting  | akun2024  | Akunting  |
