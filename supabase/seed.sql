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
