-- Update sales_visits table dengan kolom baru
alter table sales_visits add column if not exists pic_name       text;
alter table sales_visits add column if not exists kabupaten      text;
alter table sales_visits add column if not exists customer_type  text;
alter table sales_visits add column if not exists visit_status   text default 'Visited';
alter table sales_visits add column if not exists cust_status    text default 'Canvasing';
alter table sales_visits add column if not exists next_follow_up date;
