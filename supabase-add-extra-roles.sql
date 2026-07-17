-- Tambah kolom extra_roles untuk mendukung multi-role
-- (akun bisa punya role utama + role tambahan, mis. Manager yang juga tampil sebagai Sales/Teknisi)
alter table users add column if not exists extra_roles jsonb default '[]'::jsonb;
