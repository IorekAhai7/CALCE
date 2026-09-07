begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select bool_and(relrowsecurity) from pg_class
  where oid in ('public.firms'::regclass, 'public.profiles'::regclass,
    'public.firm_memberships'::regclass, 'public.firm_settings'::regclass,
    'public.audit_logs'::regclass)), 'RLS is enabled on every initial application table');
select is((select count(*) from public.firms), 2::bigint, 'both fictional firms exist');
select is((select public from storage.buckets where id = 'legal-documents'), false,
  'legal-document bucket is private');

set local role anon;
select throws_ok('select * from public.firms', '42501', null::text,
  'anonymous callers have no direct business-table access');
reset role;

-- Firm A lawyer: positive reads and negative access/escalation checks.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000102","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.firms), 1::bigint, 'lawyer sees one firm');
select is((select name from public.firms), 'Despacho ficticio A', 'lawyer sees their own firm');
select is((select count(*) from public.firms where id = '10000000-0000-4000-a000-000000000002'),
  0::bigint, 'explicit other-firm id reveals no firm');
select is((select count(*) from public.firm_settings), 1::bigint, 'settings are tenant scoped');
select is((select count(*) from public.firm_memberships), 3::bigint, 'membership visibility stays inside firm A');
select is((select count(*) from public.profiles), 1::bigint, 'profile read is limited to the authenticated user');
with changed as (update public.firm_settings set critical_days = 1 returning *)
select is((select count(*) from changed), 0::bigint, 'lawyer cannot update firm configuration');
select throws_ok($sql$update public.firm_memberships set role = 'ADMIN'
  where profile_id = '00000000-0000-4000-a000-000000000102'$sql$, '42501', null::text,
  'lawyer cannot promote their own membership');
select throws_ok($sql$update public.profiles set is_active = true$sql$, '42501', null::text,
  'users cannot override profile activation');
select throws_ok($sql$insert into public.audit_logs (firm_id, action, entity_type, entity_id)
  values ('10000000-0000-4000-a000-000000000001', 'FORGED', 'firms',
    '10000000-0000-4000-a000-000000000001')$sql$, '42501', null::text,
  'users cannot forge audit events');
reset role;

-- Firm A admin: an allowed write proves the negative checks are not blanket denial.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000101","role":"authenticated"}', true);
set local role authenticated;
with changed as (update public.firm_settings set eod_reminder_time = '17:00'
  where firm_id = '10000000-0000-4000-a000-000000000001' returning *)
select is((select count(*) from changed), 1::bigint, 'admin can update own reminder time');
select is((select count(*) from public.audit_logs), 1::bigint, 'allowed update is audited once');
select is((select actor_member_id::text from public.audit_logs),
  '20000000-0000-4000-a000-000000000101', 'audit actor is resolved from the authenticated identity');
select is((select changed_fields -> 'eod_reminder_time' ->> 'before' from public.audit_logs),
  '18:00:00', 'audit preserves the previous configuration value');
select is((select changed_fields -> 'eod_reminder_time' ->> 'after' from public.audit_logs),
  '17:00:00', 'audit preserves the new configuration value');
with changed as (update public.firm_settings set eod_reminder_time = '16:00'
  where firm_id = '10000000-0000-4000-a000-000000000002' returning *)
select is((select count(*) from changed), 0::bigint, 'admin cannot modify the other firm');
select throws_ok($sql$update public.firm_settings set firm_id = '10000000-0000-4000-a000-000000000002'
  where firm_id = '10000000-0000-4000-a000-000000000001'$sql$, '42501', null::text,
  'firm identity is not writable by application users');
select throws_ok('update public.firm_settings set critical_days = 9', '23514', null::text,
  'database rejects invalid threshold ordering');
select is((select critical_days from public.firm_settings), 2, 'invalid write leaves settings intact');
select is((select count(*) from public.audit_logs), 1::bigint, 'failed write creates no audit event');
select throws_ok('delete from public.audit_logs', '42501', null::text, 'audit history cannot be deleted by an admin');
select throws_ok($sql$update public.audit_logs set action = 'FORGED'$sql$, '42501', null::text,
  'audit history cannot be overwritten by an admin');
reset role;

-- Membership deactivation is checked in DB even with an otherwise valid JWT.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000103","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.firms), 0::bigint, 'inactive membership has no firm access');
reset role;

-- Revocation takes effect without refreshing the admin's JWT claims.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000101","role":"authenticated"}', true);
update public.profiles set is_active = false where id = '00000000-0000-4000-a000-000000000101';
set local role authenticated;
select is((select count(*) from public.firms), 0::bigint, 'inactive profile loses firm access');
with changed as (update public.firm_settings set eod_reminder_time = '15:00' returning *)
select is((select count(*) from changed), 0::bigint, 'inactive profile cannot write settings');
reset role;

-- Symmetry: B remains usable, with no settings/audit leakage from A.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000201","role":"authenticated"}', true);
set local role authenticated;
select is((select name from public.firms), 'Despacho ficticio B', 'firm B admin sees only firm B');
select is((select eod_reminder_time::text from public.firm_settings), '18:00:00', 'firm B configuration was not modified');
select is((select count(*) from public.audit_logs), 0::bigint, 'firm B cannot read firm A audit');
reset role;

-- Even a privileged writer cannot create a cross-firm actor relationship.
select throws_ok($sql$insert into public.audit_logs
  (firm_id, actor_member_id, action, entity_type, entity_id)
  values ('10000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000102',
    'INVALID_RELATION', 'firms', '10000000-0000-4000-a000-000000000002')$sql$,
  '23503', null::text, 'composite foreign key rejects a cross-firm actor');

select * from finish();
rollback;
