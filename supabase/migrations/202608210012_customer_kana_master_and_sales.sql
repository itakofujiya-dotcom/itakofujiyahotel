alter table public.customers
add column if not exists name_kana_or_roman text;

alter table public.guests
add constraint guests_name_kana_or_roman_required
check (
  length(btrim(coalesce(name_kana_or_roman, ''))) between 2 and 100
)
not valid;

with latest_customer_kana as (
  select distinct on (r.customer_id)
    r.customer_id,
    nullif(btrim(g.name_kana_or_roman), '') as name_kana_or_roman
  from public.reservations as r
  join public.guests as g on g.id = r.primary_guest_id
  where r.customer_id is not null
    and nullif(btrim(g.name_kana_or_roman), '') is not null
  order by r.customer_id, r.created_at desc, g.updated_at desc
)
update public.customers as c
set name_kana_or_roman = source.name_kana_or_roman
from latest_customer_kana as source
where source.customer_id = c.id
  and nullif(btrim(c.name_kana_or_roman), '') is null;

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

  update public.customers as c
  set name_kana_or_roman = coalesce(
    nullif(btrim(v_guest.name_kana_or_roman), ''),
    c.name_kana_or_roman
  )
  where c.id = new.customer_id;

  return new;
end;
$$;

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

  update public.customers as c
  set name_kana_or_roman = coalesce(
    nullif(btrim(new.name_kana_or_roman), ''),
    c.name_kana_or_roman
  )
  where c.id = v_customer_id;

  update public.reservations as r
  set customer_id = v_customer_id
  where r.primary_guest_id = new.id
    and r.customer_id is distinct from v_customer_id;

  return new;
end;
$$;

drop trigger if exists sync_customer_after_guest_update on public.guests;

create trigger sync_customer_after_guest_update
after update of name, name_kana_or_roman, telephone, email on public.guests
for each row
when (
  old.name is distinct from new.name
  or old.name_kana_or_roman is distinct from new.name_kana_or_roman
  or old.telephone is distinct from new.telephone
  or old.email is distinct from new.email
)
execute function public.sync_customer_after_guest_update();

create or replace function public.get_admin_customers(
  p_search text default '',
  p_sort text default 'recent',
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  id uuid,
  name text,
  name_kana_or_roman text,
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
  v_text_search text := lower(
    regexp_replace(
      normalize(btrim(coalesce(p_search, '')), NFKC),
      '[[:space:]]+',
      '',
      'g'
    )
  );
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
      c.name_kana_or_roman,
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
      or (
        v_text_search <> ''
        and lower(
          regexp_replace(normalize(c.name, NFKC), '[[:space:]]+', '', 'g')
        ) like '%' || v_text_search || '%'
      )
      or (
        v_text_search <> ''
        and lower(
          regexp_replace(
            normalize(coalesce(c.name_kana_or_roman, ''), NFKC),
            '[[:space:]]+',
            '',
            'g'
          )
        ) like '%' || v_text_search || '%'
      )
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
    s.name_kana_or_roman,
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

create or replace function public.get_admin_sales_details_with_kana(
  p_start_date date,
  p_end_date date,
  p_payment_method text default null,
  p_status_filter text default 'all',
  p_sort text default 'latest',
  p_page integer default 1,
  p_page_size integer default 30
)
returns table (
  reservation_id uuid,
  event_date date,
  reservation_number text,
  guest_name text,
  guest_name_kana_or_roman text,
  check_in date,
  check_out date,
  rooms jsonb,
  payment_method text,
  payment_status text,
  reservation_status text,
  reservation_amount_yen bigint,
  recognized_revenue_yen bigint,
  collected_yen bigint,
  cancellation_fee_yen bigint,
  refund_target_yen bigint,
  payment_issue text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  return query
  select
    detail.reservation_id,
    detail.event_date,
    detail.reservation_number,
    detail.guest_name,
    guest.name_kana_or_roman,
    detail.check_in,
    detail.check_out,
    detail.rooms,
    detail.payment_method,
    detail.payment_status,
    detail.reservation_status,
    detail.reservation_amount_yen,
    detail.recognized_revenue_yen,
    detail.collected_yen,
    detail.cancellation_fee_yen,
    detail.refund_target_yen,
    detail.payment_issue,
    detail.total_count
  from public.get_admin_sales_details(
    p_start_date,
    p_end_date,
    p_payment_method,
    p_status_filter,
    p_sort,
    p_page,
    p_page_size
  ) as detail
  join public.reservations as reservation
    on reservation.id = detail.reservation_id
  join public.guests as guest
    on guest.id = reservation.primary_guest_id
  order by
    case when p_sort = 'latest' then detail.event_date end desc,
    case when p_sort = 'oldest' then detail.event_date end asc,
    case when p_sort = 'amount' then detail.reservation_amount_yen end desc,
    detail.reservation_number desc,
    detail.reservation_id;
end;
$$;

revoke all on function public.get_admin_sales_details_with_kana(
  date, date, text, text, text, integer, integer
) from public;

grant execute on function public.get_admin_sales_details_with_kana(
  date, date, text, text, text, integer, integer
) to authenticated;
