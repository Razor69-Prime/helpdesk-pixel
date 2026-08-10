-- PXL-STG-0018 — DUMMY KPI. STAGING ONLY.
begin;
insert into tickets (id,wo_number,project_name,customer_name,description,technician,status,worked_at,created_at) values
('18000000-0000-0000-0000-000000000001','STG-KPI-WO-001','Dummy CCTV KPI','STG Customer A','PXL-STG-0018 DUMMY KPI','STG Teknisi Made','done',now()-interval '3 day',now()-interval '3 day'),
('18000000-0000-0000-0000-000000000002','STG-KPI-WO-002','Dummy Network KPI','STG Customer B','PXL-STG-0018 DUMMY KPI','STG Teknisi Made','ongoing',now()-interval '1 day',now()-interval '1 day'),
('18000000-0000-0000-0000-000000000003','STG-KPI-WO-003','Dummy Maintenance KPI','STG Customer C','PXL-STG-0018 DUMMY KPI','STG Teknisi Wayan','done',now()-interval '2 day',now()-interval '2 day') on conflict (id) do nothing;
insert into job_stages (id,ticket_id,stage,timestamp,technician) values
('18100000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','berangkat',now()-interval '3 day' + interval '8 hour','STG Teknisi Made'),
('18100000-0000-0000-0000-000000000002','18000000-0000-0000-0000-000000000001','tiba',now()-interval '3 day' + interval '9 hour','STG Teknisi Made'),
('18100000-0000-0000-0000-000000000003','18000000-0000-0000-0000-000000000001','selesai',now()-interval '3 day' + interval '12 hour','STG Teknisi Made') on conflict (id) do nothing;
insert into invoices (id,ticket_id,original_name,mime_type,uploaded_by,uploaded_at,note,total_amount,sales_pic) values
('18200000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','STG-KPI-INVOICE-001.pdf','application/pdf','PXL-STG-0018',now()-interval '2 day','PXL-STG-0018 DUMMY KPI',15000000,'STG Sales Farel'),
('18200000-0000-0000-0000-000000000002','18000000-0000-0000-0000-000000000003','STG-KPI-INVOICE-002.pdf','application/pdf','PXL-STG-0018',now()-interval '1 day','PXL-STG-0018 DUMMY KPI',8500000,'STG Sales Ayu') on conflict (id) do nothing;
insert into sales_visits (id,sales_pic,sales_user_id,customer_name,customer_phone,address,estimasi_omzet,realisasi_omzet,status,prospect_date,notes,created_at,updated_at) values
('18300000-0000-0000-0000-000000000001','STG Sales Farel','stg-sales-farel','STG Villa KPI','081200001801','Badung, Bali',20000000,15000000,'closed_won',current_date-3,'PXL-STG-0018 DUMMY KPI',now()-interval '3 day',now()-interval '3 day'),
('18300000-0000-0000-0000-000000000002','STG Sales Farel','stg-sales-farel','STG Restaurant KPI','081200001802','Denpasar, Bali',12000000,0,'follow_up_1',current_date-2,'PXL-STG-0018 DUMMY KPI',now()-interval '2 day',now()-interval '2 day'),
('18300000-0000-0000-0000-000000000003','STG Sales Ayu','stg-sales-ayu','STG Office KPI','081200001803','Gianyar, Bali',9000000,0,'prospect',current_date-1,'PXL-STG-0018 DUMMY KPI',now()-interval '1 day',now()-interval '1 day') on conflict (id) do nothing;
commit;
