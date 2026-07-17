-- Tabel notifikasi in-app
create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,       -- tiket, kunjungan, pr, mr, project, invoice
  text          text not null,       -- isi pesan notifikasi (boleh HTML <b> untuk highlight)
  target_role   text,                -- role yang menerima jika bukan target user spesifik: 'superadmin','manager','admin', dsb. Null = broadcast ke semua role terkait
  target_user_id uuid,               -- kalau notifikasi spesifik untuk 1 user (mis. teknisi yang di-assign)
  ref_id        text,                -- id record terkait (ticket id, pr id, dst) untuk keperluan link/navigasi nanti
  created_by    text,                -- nama user yang memicu notifikasi ini
  is_read       boolean default false,
  read_by       jsonb default '[]'::jsonb,  -- array user_id yang sudah membaca (untuk notif broadcast/role)
  created_at    timestamptz default now()
);

create index if not exists idx_notifications_target_role on notifications(target_role);
create index if not exists idx_notifications_target_user on notifications(target_user_id);
create index if not exists idx_notifications_created_at on notifications(created_at desc);

alter table notifications enable row level security;

create policy "Allow all for authenticated" on notifications
  for all using (true) with check (true);
