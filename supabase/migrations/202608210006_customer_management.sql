create or replace function public.normalize_customer_name(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '[[:space:]　]+', '', 'g'));
$$;

create or replace function public.normalize_customer_phone(p_phone text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(coalesce(p_phone, ''), '[^0-9]+', '', 'g');
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text generated always as (
    public.normalize_customer_name(name)
  ) stored,
  phone text not null,
  normalized_phone text generated always as (
    public.normalize_customer_phone(phone)
  ) stored,
  email text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_required check (normalized_name <> ''),
  constraint customers_phone_required check (normalized_phone <> ''),
  constraint customers_identity_key unique (normalized_name, normalized_phone)
);

create index customers_name_idx on public.customers(name);
create index customers_normalized_phone_idx
on public.customers(normalized_phone);

create trigger set_customers_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

alter table public.reservations
add column customer_id uuid
references public.customers(id)
on delete restrict;

create index reservations_customer_id_idx
on public.reservations(customer_id);

create or replace function public.find_or_create_customer(
  p_name text,
  p_phone text,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  if public.normalize_customer_name(p_name) = ''
    or public.normalize_customer_phone(p_phone) = ''
  then
    raise exception 'CUSTOMER_IDENTITY_REQUIRED' using errcode = '22023';
  end if;

  insert into public.customers(name, phone, email)
  values (
    btrim(p_name),
    btrim(p_phone),
    nullif(lower(btrim(coalesce(p_email, ''))), '')
  )
  on conflict (normalized_name, normalized_phone)
  do update set
    name = excluded.name,
    phone = excluded.phone,
    email = coalesce(excluded.email, public.customers.email)
  returning id into v_customer_id;

  return v_customer_id;
end;
$$;

create or replace function public.set_reservation_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.guests%rowtype;
begin
  select g.* into strict v_guest
  from public.guests as g
  where g.id = new.primary_guest_id;

  new.customer_id := public.find_or_create_customer(
    v_guest.name,
    v_guest.telephone,
    v_guest.email
  );
  return new;
end;
$$;

create trigger set_reservation_customer_before_write
before insert or update of primary_guest_id on public.reservations
for each row
execute function public.set_reservation_customer();

create or replace function public.sync_customer_after_guest_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  v_customer_id := public.find_or_create_customer(
    new.name,
    new.telephone,
    new.email
  );

  update public.reservations as r
  set customer_id = v_customer_id
  where r.primary_guest_id = new.id
    and r.customer_id is distinct from v_customer_id;

  return new;
end;
$$;

create trigger sync_customer_after_guest_update
after update of name, telephone, email on public.guests
for each row
when (
  old.name is distinct from new.name
  or old.telephone is distinct from new.telephone
  or old.email is distinct from new.email
)
execute function public.sync_customer_after_guest_update();

with customer_source as (
  select
    g.name,
    g.telephone,
    g.email,
    public.normalize_customer_name(g.name) as normalized_name,
    public.normalize_customer_phone(g.telephone) as normalized_phone,
    g.updated_at
  from public.guests as g
), latest_customer_source as (
  select distinct on (normalized_name, normalized_phone)
    name,
    telephone,
    email,
    normalized_name,
    normalized_phone
  from customer_source
  where normalized_name <> '' and normalized_phone <> ''
  order by normalized_name, normalized_phone, updated_at desc
)
insert into public.customers(name, phone, email)
select name, telephone, nullif(lower(btrim(email)), '')
from latest_customer_source
on conflict (normalized_name, normalized_phone)
do update set email = coalesce(excluded.email, public.customers.email);

update public.reservations as r
set customer_id = c.id
from public.guests as g
join public.customers as c
  on c.normalized_name = public.normalize_customer_name(g.name)
 and c.normalized_phone = public.normalize_customer_phone(g.telephone)
where g.id = r.primary_guest_id
  and r.customer_id is null;

alter table public.customers enable row level security;

create policy "admin manage customers"
on public.customers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on public.customers from anon;
grant select, insert, update, delete on public.customers to authenticated;

revoke all on function public.normalize_customer_name(text) from public;
revoke all on function public.normalize_customer_phone(text) from public;
revoke all on function public.find_or_create_customer(text, text, text) from public;
revoke all on function public.set_reservation_customer() from public;
revoke all on function public.sync_customer_after_guest_update() from public;

grant execute on function public.normalize_customer_name(text) to authenticated;
grant execute on function public.normalize_customer_phone(text) to authenticated;

create or replace function public.get_admin_customers(
  p_search text default '',
  p_sort text default 'recent',
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  id uuid,
  name text,
  phone text,
  email text,
  memo text,
  total_reservations bigint,
  completed_stays bigint,
  first_visit date,
  recent_visit date,
  total_nights bigint,
  average_visit_interval_days numeric,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := btrim(coalesce(p_search, ''));
  v_phone_search text := public.normalize_customer_phone(p_search);
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_sort not in ('recent', 'visits', 'name') then
    raise exception 'INVALID_CUSTOMER_SORT' using errcode = '22023';
  end if;

  return query
  with customer_stats as (
    select
      c.id,
      c.name,
      c.phone,
      c.email,
      c.memo,
      count(r.id) as total_reservations,
      count(r.id) filter (where r.status = 'checked_out') as completed_stays,
      min(r.check_in) filter (where r.status = 'checked_out') as first_visit,
      max(r.check_in) filter (where r.status = 'checked_out') as recent_visit,
      coalesce(
        sum(r.check_out - r.check_in) filter (where r.status = 'checked_out'),
        0
      )::bigint as total_nights
    from public.customers as c
    left join public.reservations as r on r.customer_id = c.id
    where v_search = ''
      or c.name ilike '%' || v_search || '%'
      or (
        v_phone_search <> ''
        and c.normalized_phone like '%' || v_phone_search || '%'
      )
    group by c.id
  ), with_interval as (
    select
      cs.*,
      case
        when cs.completed_stays > 1 then
          round(
            (cs.recent_visit - cs.first_visit)::numeric
            / (cs.completed_stays - 1),
            1
          )
        else null
      end as average_visit_interval_days
    from customer_stats as cs
  )
  select
    s.id,
    s.name,
    s.phone,
    s.email,
    s.memo,
    s.total_reservations,
    s.completed_stays,
    s.first_visit,
    s.recent_visit,
    s.total_nights,
    s.average_visit_interval_days,
    count(*) over() as total_count
  from with_interval as s
  order by
    case when p_sort = 'recent' then s.recent_visit end desc nulls last,
    case when p_sort = 'visits' then s.completed_stays end desc,
    case when p_sort = 'name' then s.name end asc,
    s.name asc,
    s.id asc
  limit v_page_size
  offset (v_page - 1) * v_page_size;
end;
$$;

revoke all on function public.get_admin_customers(text, text, integer, integer)
from public;

grant execute on function public.get_admin_customers(text, text, integer, integer)
to authenticated;
