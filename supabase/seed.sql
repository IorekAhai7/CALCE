-- Local/CI fixtures only. Reserved .test addresses; no real people or clients.
-- No passwords or auth identities for interactive login are provisioned yet.
insert into auth.users (id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-a000-000000000101', 'authenticated', 'authenticated', 'admin.a@calce.test', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-000000000102', 'authenticated', 'authenticated', 'lawyer.a@calce.test', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-000000000103', 'authenticated', 'authenticated', 'inactive.a@calce.test', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-000000000201', 'authenticated', 'authenticated', 'admin.b@calce.test', now(), '{}', '{}', now(), now());

insert into public.profiles (id, first_name, last_name) values
  ('00000000-0000-4000-a000-000000000101', 'Admin', 'Demo A'),
  ('00000000-0000-4000-a000-000000000102', 'Abogado', 'Demo A'),
  ('00000000-0000-4000-a000-000000000103', 'Inactivo', 'Demo A'),
  ('00000000-0000-4000-a000-000000000201', 'Admin', 'Demo B');

insert into public.firms (id, name) values
  ('10000000-0000-4000-a000-000000000001', 'Despacho ficticio A'),
  ('10000000-0000-4000-a000-000000000002', 'Despacho ficticio B');
insert into public.firm_settings (firm_id) select id from public.firms;

insert into public.firm_memberships (id, firm_id, profile_id, role, status) values
  ('20000000-0000-4000-a000-000000000101', '10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'ADMIN', 'ACTIVE'),
  ('20000000-0000-4000-a000-000000000102', '10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000102', 'LAWYER', 'ACTIVE'),
  ('20000000-0000-4000-a000-000000000103', '10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000103', 'LAWYER', 'INACTIVE'),
  ('20000000-0000-4000-a000-000000000201', '10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000201', 'ADMIN', 'ACTIVE');

-- Explicitly fictional local accounts. Never apply seed.sql to a shared environment.
update auth.users set instance_id='00000000-0000-0000-0000-000000000000',
  encrypted_password=extensions.crypt('CalceDemo!2026',extensions.gen_salt('bf')),
  confirmation_token='',recovery_token='',email_change_token_new='',email_change='',
  raw_app_meta_data='{"provider":"email","providers":["email"]}'::jsonb
where email in ('admin.a@calce.test','lawyer.a@calce.test','inactive.a@calce.test','admin.b@calce.test');
insert into auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at)
select gen_random_uuid(),id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now()
from auth.users where email in ('admin.a@calce.test','lawyer.a@calce.test','inactive.a@calce.test','admin.b@calce.test');

insert into public.clients(id,firm_id,name,email,phone,channel) values
 ('30000000-0000-4000-a000-000000000001','10000000-0000-4000-a000-000000000001','Cliente demostración A','cliente.a@calce.test','','REFERRAL'),
 ('30000000-0000-4000-a000-000000000002','10000000-0000-4000-a000-000000000002','Cliente demostración B','cliente.b@calce.test','','PHONE');
insert into public.matters(id,firm_id,client_id,responsible_id,title) values
 ('40000000-0000-4000-a000-000000000001','10000000-0000-4000-a000-000000000001','30000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000101','Expediente demostración A'),
 ('40000000-0000-4000-a000-000000000002','10000000-0000-4000-a000-000000000002','30000000-0000-4000-a000-000000000002','20000000-0000-4000-a000-000000000201','Expediente demostración B');
insert into public.events(firm_id,matter_id,title,kind,starts_at,location) values
 ('10000000-0000-4000-a000-000000000001','40000000-0000-4000-a000-000000000001','Audiencia de ejemplo','HEARING',now()+interval '1 day','Sede ficticia');
insert into public.tasks(firm_id,matter_id,title,due_on) values
 ('10000000-0000-4000-a000-000000000001','40000000-0000-4000-a000-000000000001','Revisar documentos de ejemplo',(now() at time zone 'America/Mexico_City')::date);
