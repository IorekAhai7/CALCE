-- Business writes are explicit transactional RPCs. Direct REST writes remain denied.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  name text not null check (length(btrim(name)) between 1 and 160),
  email text not null default '' check (length(email) <= 254),
  phone text not null default '' check (length(phone) <= 40),
  channel text not null check (channel in ('WHATSAPP','PHONE','REFERRAL','WALK_IN','OTHER')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (firm_id,id)
);
create index clients_firm_name on public.clients(firm_id,name);
create table public.matters (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id),
  client_id uuid not null, responsible_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 180),
  description text not null default '' check (length(description) <= 5000),
  status text not null default 'OPEN' check (status in ('OPEN','ARCHIVED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(firm_id,id),
  foreign key(firm_id,client_id) references public.clients(firm_id,id),
  foreign key(firm_id,responsible_id) references public.firm_memberships(firm_id,id)
);
create index matters_firm_status on public.matters(firm_id,status,created_at desc);
create table public.events (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null, matter_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 180),
  kind text not null check (kind in ('HEARING','DILIGENCE','FILING','REVIEW')),
  starts_at timestamptz not null, location text not null default '' check (length(location) <= 300),
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED','RECORDED','CANCELLED')),
  version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(firm_id,id), unique(firm_id,matter_id,id),
  foreign key(firm_id,matter_id) references public.matters(firm_id,id)
);
create index events_agenda on public.events(firm_id,status,starts_at);
create table public.event_changes (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null, event_id uuid not null,
  old_starts_at timestamptz not null, new_starts_at timestamptz not null,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  actor_id uuid not null, created_at timestamptz not null default now(),
  foreign key(firm_id,event_id) references public.events(firm_id,id),
  foreign key(firm_id,actor_id) references public.firm_memberships(firm_id,id)
);
create index event_changes_event on public.event_changes(firm_id,event_id,created_at);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null, matter_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 180), due_on date not null,
  status text not null default 'OPEN' check (status in ('OPEN','DONE','CANCELLED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(firm_id,id), foreign key(firm_id,matter_id) references public.matters(firm_id,id)
);
create index tasks_due on public.tasks(firm_id,status,due_on);
create table public.movements (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null, matter_id uuid not null,
  event_id uuid, occurred_at timestamptz not null,
  notes text not null check (length(btrim(notes)) between 1 and 10000), actor_id uuid not null,
  created_at timestamptz not null default now(),
  unique(firm_id,id), unique(event_id),
  foreign key(firm_id,matter_id) references public.matters(firm_id,id),
  foreign key(firm_id,matter_id,event_id) references public.events(firm_id,matter_id,id),
  foreign key(firm_id,actor_id) references public.firm_memberships(firm_id,id)
);
create index movements_matter on public.movements(firm_id,matter_id,occurred_at desc);
create table public.documents (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null, matter_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  object_path text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING','READY','CANCELLED')),
  actor_id uuid not null, created_at timestamptz not null default now(),
  unique(firm_id,id), foreign key(firm_id,matter_id) references public.matters(firm_id,id),
  foreign key(firm_id,actor_id) references public.firm_memberships(firm_id,id),
  check (object_path = firm_id::text || '/' || matter_id::text || '/' || id::text)
);
create index documents_matter on public.documents(firm_id,matter_id,created_at desc);

do $$ declare t text; begin
  foreach t in array array['clients','matters','events','event_changes','tasks','movements','documents'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy tenant_read on public.%I for select to authenticated using (private.has_active_membership(firm_id))',t);
  end loop;
  foreach t in array array['clients','matters','events','tasks'] loop
    execute format('create trigger touch_updated before update on public.%I for each row execute function private.touch_updated_at()',t);
  end loop;
end $$;

create function private.require_member(f uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
  if not private.has_active_membership(f) then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
  select id into strict actor from public.firm_memberships where firm_id=f and profile_id=auth.uid();
  return actor;
end $$;
create function private.require_open_matter(f uuid,m uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s text;
begin
  select status into s from public.matters where firm_id=f and id=m for update;
  if s is null then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  if s <> 'OPEN' then raise exception 'MATTER_ARCHIVED' using errcode='55000'; end if;
end $$;
create function private.case_audit(f uuid,a uuid,verb text,entity text,entity_uuid uuid,detail jsonb default null)
returns void language sql security definer set search_path='' as $$
  insert into public.audit_logs(firm_id,actor_member_id,action,entity_type,entity_id,metadata)
  values(f,a,verb,entity,entity_uuid,detail);
$$;
revoke all on function private.require_member(uuid),private.require_open_matter(uuid,uuid),
  private.case_audit(uuid,uuid,text,text,uuid,jsonb) from public,anon,authenticated;

-- Only minimal names for assignment, not coworkers' contact/profile data.
create function public.firm_team(p_firm uuid)
returns table(id uuid,display_name text)
language plpgsql security definer set search_path='' as $$ begin
  perform private.require_member(p_firm);
  return query select m.id,p.first_name || ' ' || p.last_name from public.firm_memberships m
    join public.profiles p on p.id=m.profile_id where m.firm_id=p_firm and m.status='ACTIVE' and p.is_active order by p.first_name;
end $$;
create function public.save_client(p_firm uuid,p_name text,p_email text,p_phone text,p_channel text,p_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid := private.require_member(p_firm); result uuid;
begin
  if p_id is null then
    insert into public.clients(firm_id,name,email,phone,channel) values(p_firm,btrim(p_name),btrim(p_email),btrim(p_phone),p_channel) returning id into result;
  else
    update public.clients set name=btrim(p_name),email=btrim(p_email),phone=btrim(p_phone),channel=p_channel
      where id=p_id and firm_id=p_firm returning id into result;
    if result is null then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  end if;
  perform private.case_audit(p_firm,a,case when p_id is null then 'CLIENT_CREATED' else 'CLIENT_UPDATED' end,'clients',result);
  return result;
end $$;
create function public.create_matter(p_firm uuid,p_client uuid,p_responsible uuid,p_title text,p_description text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid := private.require_member(p_firm); result uuid;
begin
  if not exists(select 1 from public.firm_memberships m join public.profiles p on p.id=m.profile_id
    where m.id=p_responsible and m.firm_id=p_firm and m.status='ACTIVE' and p.is_active)
    then raise exception 'INVALID_RESPONSIBLE' using errcode='23514'; end if;
  insert into public.matters(firm_id,client_id,responsible_id,title,description)
    values(p_firm,p_client,p_responsible,btrim(p_title),p_description) returning id into result;
  perform private.case_audit(p_firm,a,'MATTER_CREATED','matters',result);
  return result;
end $$;
create function public.set_matter_archived(p_firm uuid,p_matter uuid,p_archived boolean)
returns void language plpgsql security definer set search_path='' as $$
declare a uuid := private.require_member(p_firm); previous text; desired text := case when p_archived then 'ARCHIVED' else 'OPEN' end;
begin
  if p_archived is null then raise exception 'INVALID_STATE' using errcode='23514'; end if;
  select status into previous from public.matters where firm_id=p_firm and id=p_matter for update;
  if previous is null then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  if previous=desired then return; end if;
  update public.matters set status=desired where id=p_matter;
  perform private.case_audit(p_firm,a,'MATTER_STATUS_CHANGED','matters',p_matter,jsonb_build_object('before',previous,'after',desired));
end $$;
create function public.add_event(p_firm uuid,p_matter uuid,p_title text,p_kind text,p_starts_at timestamptz,p_location text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid := private.require_member(p_firm); result uuid;
begin
  perform private.require_open_matter(p_firm,p_matter);
  insert into public.events(firm_id,matter_id,title,kind,starts_at,location)
    values(p_firm,p_matter,btrim(p_title),p_kind,p_starts_at,p_location) returning id into result;
  perform private.case_audit(p_firm,a,'EVENT_CREATED','events',result); return result;
end $$;
create function public.reschedule_event(p_firm uuid,p_event uuid,p_starts_at timestamptz,p_reason text,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare a uuid := private.require_member(p_firm); e public.events;
begin
  select * into e from public.events where firm_id=p_firm and id=p_event;
  perform private.require_open_matter(p_firm,e.matter_id);
  select * into e from public.events where firm_id=p_firm and id=p_event for update;
  if e.status <> 'SCHEDULED' or e.version is distinct from p_version then raise exception 'STALE_EVENT' using errcode='40001'; end if;
  if p_starts_at is not distinct from e.starts_at then raise exception 'SAME_DATE' using errcode='23514'; end if;
  insert into public.event_changes(firm_id,event_id,old_starts_at,new_starts_at,reason,actor_id)
    values(p_firm,p_event,e.starts_at,p_starts_at,btrim(p_reason),a);
  update public.events set starts_at=p_starts_at,version=version+1 where id=p_event;
  perform private.case_audit(p_firm,a,'EVENT_RESCHEDULED','events',p_event);
end $$;
create function public.cancel_event(p_firm uuid,p_event uuid,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare a uuid := private.require_member(p_firm); e public.events;
begin
  select * into e from public.events where firm_id=p_firm and id=p_event;
  perform private.require_open_matter(p_firm,e.matter_id);
  update public.events set status='CANCELLED',version=version+1
    where id=p_event and firm_id=p_firm and status='SCHEDULED' and version=p_version;
  if not found then raise exception 'STALE_EVENT' using errcode='40001'; end if;
  perform private.case_audit(p_firm,a,'EVENT_CANCELLED','events',p_event);
end $$;
create function public.add_task(p_firm uuid,p_matter uuid,p_title text,p_due_on date)
returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid := private.require_member(p_firm); result uuid;
begin
  perform private.require_open_matter(p_firm,p_matter);
  insert into public.tasks(firm_id,matter_id,title,due_on) values(p_firm,p_matter,btrim(p_title),p_due_on) returning id into result;
  perform private.case_audit(p_firm,a,'TASK_CREATED','tasks',result); return result;
end $$;
create function public.close_task(p_firm uuid,p_task uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare a uuid := private.require_member(p_firm); m uuid;
begin
  if p_status is null or p_status not in ('DONE','CANCELLED') then raise exception 'INVALID_STATE' using errcode='23514'; end if;
  select matter_id into m from public.tasks where firm_id=p_firm and id=p_task;
  perform private.require_open_matter(p_firm,m);
  update public.tasks set status=p_status where firm_id=p_firm and id=p_task and status='OPEN';
  if not found then raise exception 'STALE_TASK' using errcode='40001'; end if;
  perform private.case_audit(p_firm,a,'TASK_' || p_status,'tasks',p_task);
end $$;
-- Movement + event closure + optional next task commit or roll back together.
create function public.record_movement(p_firm uuid,p_matter uuid,p_occurred_at timestamptz,p_notes text,
  p_event uuid default null,p_next_title text default null,p_next_due date default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid := private.require_member(p_firm); result uuid;
begin
  perform private.require_open_matter(p_firm,p_matter);
  if p_occurred_at > now() then raise exception 'FUTURE_MOVEMENT' using errcode='23514'; end if;
  if p_event is not null then
    update public.events set status='RECORDED',version=version+1 where firm_id=p_firm and matter_id=p_matter and id=p_event and status='SCHEDULED';
    if not found then raise exception 'STALE_EVENT' using errcode='40001'; end if;
  end if;
  insert into public.movements(firm_id,matter_id,event_id,occurred_at,notes,actor_id)
    values(p_firm,p_matter,p_event,p_occurred_at,btrim(p_notes),a) returning id into result;
  if p_next_title is not null or p_next_due is not null then
    perform public.add_task(p_firm,p_matter,p_next_title,p_next_due);
  end if;
  perform private.case_audit(p_firm,a,'MOVEMENT_RECORDED','movements',result);
  return result;
end $$;
create function public.reserve_document(p_firm uuid,p_matter uuid,p_name text,p_mime text,p_size bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid := private.require_member(p_firm); result uuid := gen_random_uuid();
begin
  perform private.require_open_matter(p_firm,p_matter);
  insert into public.documents(id,firm_id,matter_id,name,mime_type,byte_size,object_path,actor_id)
    values(result,p_firm,p_matter,p_name,p_mime,p_size,p_firm::text || '/' || p_matter::text || '/' || result::text,a);
  return result;
end $$;
create function public.finish_document(p_firm uuid,p_document uuid)
returns void language plpgsql security definer set search_path='' as $$
declare a uuid := private.require_member(p_firm); d public.documents;
begin
  select * into d from public.documents where firm_id=p_firm and id=p_document and actor_id=a for update;
  if d.id is null then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  if d.status='READY' then return; end if;
  if d.status<>'PENDING' then raise exception 'INVALID_STATE' using errcode='55000'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='legal-documents' and o.name=d.object_path
    and (o.metadata->>'size')::bigint=d.byte_size and o.metadata->>'mimetype'=d.mime_type)
    then raise exception 'UPLOAD_INCOMPLETE' using errcode='23514'; end if;
  update public.documents set status='READY' where id=d.id;
  perform private.case_audit(p_firm,a,'DOCUMENT_READY','documents',d.id);
end $$;
create function public.cancel_document(p_firm uuid,p_document uuid)
returns void language plpgsql security definer set search_path='' as $$
declare a uuid := private.require_member(p_firm);
begin
  update public.documents set status='CANCELLED' where id=p_document and firm_id=p_firm and actor_id=a and status='PENDING';
  if not found then raise exception 'INVALID_STATE' using errcode='55000'; end if;
  perform private.case_audit(p_firm,a,'UPLOAD_CANCELLED','documents',p_document);
end $$;

-- No client may call helpers or forge history through direct table writes.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array['firm_team','save_client','create_matter','set_matter_archived',
      'add_event','reschedule_event','cancel_event','add_task','close_task','record_movement','reserve_document','finish_document','cancel_document']) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;

-- Storage RLS checks the exact reserved path; folders alone never authorize bytes.
create policy legal_upload on storage.objects for insert to authenticated with check (
  bucket_id='legal-documents' and exists(select 1 from public.documents d
    join public.firm_memberships m on m.id=d.actor_id and m.firm_id=d.firm_id
    join public.matters c on c.id=d.matter_id and c.firm_id=d.firm_id
    where d.object_path=storage.objects.name and d.status='PENDING' and m.profile_id=(select auth.uid()) and c.status='OPEN')
);
create policy legal_download on storage.objects for select to authenticated using (
  bucket_id='legal-documents' and exists(select 1 from public.documents d where d.object_path=storage.objects.name and d.status='READY')
);
-- No overwrite/delete policies. Interrupted uploads remain recorded for explicit recovery.
