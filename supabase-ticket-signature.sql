-- Tambah kolom tanda tangan Teknisi & Customer saat tiket diselesaikan
alter table tickets add column if not exists tech_signature     text;
alter table tickets add column if not exists customer_signature text;
