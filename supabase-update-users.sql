-- ═══════════════════════════════════════════════════════
--  UPDATE AKUN — Nama Tim Asli Pixel Solusindo
--  Jalankan di: Supabase SQL Editor → Run
--  Sesuaikan username/password sesuai kebutuhan
-- ═══════════════════════════════════════════════════════

-- ── SALES PIC (5 orang aktif) ──
update users set username='dewa_gede',  name='Dewa Gede Satrya Cesa',   password='dewa@2026'  where id='u4';

insert into users (id, username, password, name, role, custom_menus) values
  ('u-sales2', 'wayan_sumadi', 'wayan@2026', 'Wayan Sumadi',          'sales', '[]'),
  ('u-sales3', 'dea_eka',      'dea@2026',   'Ni Putu Dea Eka Putri', 'sales', '[]'),
  ('u-sales4', 'komang_budha', 'komang@2026','I Komang Budha Astawa', 'sales', '[]'),
  ('u-sales5', 'putu_eka',     'putueka@2026','I Putu Eka Hendrayana','sales', '[]')
on conflict (id) do nothing;

-- ── TEKNISI — sesuaikan nama dengan tim teknisi asli ──
-- Ganti 'Nama Teknisi X' dan username sesuai nama sebenarnya
update users set username='teknisi1', name='Nama Teknisi 1', password='teknisi1@2026' where id='u5';
update users set username='teknisi2', name='Nama Teknisi 2', password='teknisi2@2026' where id='u6';
update users set username='teknisi3', name='Nama Teknisi 3', password='teknisi3@2026' where id='u7';
update users set username='teknisi4', name='Nama Teknisi 4', password='teknisi4@2026' where id='u8';

-- ── AKUNTING ──
update users set username='akunting', name='Nama Akunting', password='akunting@2026' where id='u2';

-- ── MANAGER ──
update users set username='manager', name='Nama Manager', password='manager@2026' where id='u3';

-- ── ADMIN ──
update users set username='admin', name='Admin Pixel Solusindo', password='admin@2026' where id='u1';

-- ── Cek hasil ──
select id, username, name, role from users order by role, name;
