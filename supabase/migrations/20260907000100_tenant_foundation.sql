-- Initial tenant/identity boundary. Business modules follow in separate migrations.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- New application tables are opt-in. Every new migration must grant deliberately.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

create type public.firm_status as enum ('ACTIVE', 'INACTIVE');
create type public.membership_role as enum ('ADMIN', 'LAWYER');
create type public.membership_status as enum ('ACTIVE', 'INACTIVE');

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  legal_name text,
  status public.firm_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  phone text,
  avatar_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.firm_memberships (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  role public.membership_role not null,
  status public.membership_status not null default 'ACTIVE',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, profile_id),
  unique (firm_id, id)
);
create index firm_memberships_profile_idx on public.firm_memberships(profile_id);

create table public.firm_settings (
  firm_id uuid primary key references public.firms(id) on delete restrict,
  timezone text not null default 'America/Mexico_City',
  locale text not null default 'es-MX',
  default_currency text not null default 'MXN' check (default_currency ~ '^[A-Z]{3}$'),
  critical_days integer not null default 2,
  warning_days integer not null default 7,
  eod_reminder_enabled boolean not null default true,
  eod_reminder_time time not null default '18:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_risk_thresholds check (critical_days >= 0 and warning_days > critical_days)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete restrict,
  actor_member_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  changed_fields jsonb,
  metadata jsonb,
  occurred_at timestamptz not null default now(),
  constraint audit_actor_same_firm foreign key (firm_id, actor_member_id)
    references public.firm_memberships(firm_id, id) on delete restrict
);
create index audit_logs_firm_time_idx on public.audit_logs(firm_id, occurred_at desc);

-- This narrow SECURITY DEFINER helper prevents recursive membership RLS.
-- The caller identity always comes from auth.uid(), never a supplied user id.
create function private.has_active_membership(target_firm_id uuid, admin_only boolean default false)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.firm_memberships as membership
    join public.profiles as profile on profile.id = membership.profile_id
    join public.firms as firm on firm.id = membership.firm_id
    where membership.firm_id = target_firm_id
      and membership.profile_id = auth.uid()
      and membership.status = 'ACTIVE'
      and profile.is_active
      and firm.status = 'ACTIVE'
      and (not admin_only or membership.role = 'ADMIN')
  );
$$;
revoke all on function private.has_active_membership(uuid, boolean) from public, anon;
grant execute on function private.has_active_membership(uuid, boolean) to authenticated;

alter table public.firms enable row level security;
alter table public.profiles enable row level security;
alter table public.firm_memberships enable row level security;
alter table public.firm_settings enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.firms, public.profiles, public.firm_memberships,
  public.firm_settings, public.audit_logs from anon, authenticated;
grant select on public.firms, public.profiles, public.firm_memberships,
  public.firm_settings, public.audit_logs to authenticated;
grant update (critical_days, warning_days, eod_reminder_enabled, eod_reminder_time)
  on public.firm_settings to authenticated;

create policy firms_read on public.firms for select to authenticated
  using (private.has_active_membership(id));
create policy profiles_read_self on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy memberships_read on public.firm_memberships for select to authenticated
  using (private.has_active_membership(firm_id));
create policy settings_read on public.firm_settings for select to authenticated
  using (private.has_active_membership(firm_id));
create policy settings_update_admin on public.firm_settings for update to authenticated
  using (private.has_active_membership(firm_id, true))
  with check (private.has_active_membership(firm_id, true));
create policy audit_read_admin on public.audit_logs for select to authenticated
  using (private.has_active_membership(firm_id, true));

-- Lifecycle and membership writes will be exposed through explicit use cases.
-- Authenticated callers cannot modify role, firm_id, active status or audit rows.
create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

create trigger firms_updated before update on public.firms
  for each row execute function private.touch_updated_at();
create trigger profiles_updated before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger memberships_updated before update on public.firm_memberships
  for each row execute function private.touch_updated_at();
create trigger settings_updated before update on public.firm_settings
  for each row execute function private.touch_updated_at();

-- Only configuration fields are captured; no legal notes or document content.
create function private.audit_firm_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid;
  changes jsonb;
begin
  select jsonb_object_agg(field.key, jsonb_build_object(
    'before', to_jsonb(old) -> field.key, 'after', field.value))
    into changes
    from jsonb_each(to_jsonb(new)) as field
    where field.key not in ('created_at', 'updated_at')
      and field.value is distinct from (to_jsonb(old) -> field.key);
  if changes is not null then
    select id into actor_id from public.firm_memberships
      where firm_id = new.firm_id and profile_id = auth.uid();
    insert into public.audit_logs
      (firm_id, actor_member_id, action, entity_type, entity_id, changed_fields)
      values (new.firm_id, actor_id, 'FIRM_SETTINGS_UPDATED', 'firm_settings', new.firm_id, changes);
  end if;
  return new;
end;
$$;
revoke all on function private.audit_firm_settings() from public, anon, authenticated;
create trigger settings_audited after update on public.firm_settings
  for each row execute function private.audit_firm_settings();

-- Bytes remain inaccessible until matter-scoped metadata and policies arrive.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('legal-documents', 'legal-documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
