-- Tambah kolom status aktif/nonaktif ke tabel users
alter table users add column if not exists is_active boolean default true;

-- Set semua akun yang sudah ada menjadi aktif secara default
update users set is_active = true where is_active is null;
