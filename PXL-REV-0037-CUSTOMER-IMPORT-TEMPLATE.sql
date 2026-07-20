-- TEMPLATE IMPORT CUSTOMER EXISTING KE STAGING
-- Ganti baris VALUES dengan data customer Anda. Data belum langsung masuk master CRM.
insert into crm_customer_import_staging
(legacy_customer_id,source_name,name,type,sales_pic,phone,normalized_phone,email,address,import_status)
values
('LEGACY-001','existing_customer','Contoh Customer','B2B','Nama Sales','081234567890','6281234567890',null,'Badung, Bali','pending');

-- Cek potensi duplikat sebelum commit
select s.id,s.name,s.phone,c.id as matched_customer_id,c.name as matched_name,c.phone as matched_phone
from crm_customer_import_staging s
left join crm_customers c
  on (s.normalized_phone is not null and s.normalized_phone=c.normalized_phone)
  or (s.legacy_customer_id is not null and s.legacy_customer_id=c.legacy_customer_id and s.source_name=c.source_name)
where s.import_status='pending';
