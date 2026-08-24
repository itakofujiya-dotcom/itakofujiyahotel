drop function if exists public.get_admin_customers(text, text, integer, integer);

create function public.get_admin_customers(
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
  with customer_base as (
    select
      c.id,
      c.name,
      latest_guest.name_kana_or_roman,
      c.phone,
      c.email,
      c.memo
    from public.customers as c
    left join lateral (
      select nullif(btrim(g.name_kana_or_roman), '') as name_kana_or_roman
      from public.reservations as recent_reservation
      join public.guests as g
        on g.id = recent_reservation.primary_guest_id
      where recent_reservation.customer_id = c.id
        and nullif(btrim(g.name_kana_or_roman), '') is not null
      order by recent_reservation.created_at desc, g.updated_at desc
      limit 1
    ) as latest_guest on true
    where v_search = ''
      or (
        v_text_search <> ''
        and lower(
          regexp_replace(
            normalize(c.name, NFKC),
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
      or exists (
        select 1
        from public.reservations as matched_reservation
        join public.guests as matched_guest
          on matched_guest.id = matched_reservation.primary_guest_id
        where matched_reservation.customer_id = c.id
          and v_text_search <> ''
          and lower(
            regexp_replace(
              normalize(coalesce(matched_guest.name_kana_or_roman, ''), NFKC),
              '[[:space:]]+',
              '',
              'g'
            )
          ) like '%' || v_text_search || '%'
      )
  ), customer_stats as (
    select
      cb.id,
      cb.name,
      cb.name_kana_or_roman,
      cb.phone,
      cb.email,
      cb.memo,
      count(r.id) as total_reservations,
      count(r.id) filter (where r.status = 'checked_out') as completed_stays,
      min(r.check_in) filter (where r.status = 'checked_out') as first_visit,
      max(r.check_in) filter (where r.status = 'checked_out') as recent_visit,
      coalesce(
        sum(r.check_out - r.check_in) filter (where r.status = 'checked_out'),
        0
      )::bigint as total_nights
    from customer_base as cb
    left join public.reservations as r on r.customer_id = cb.id
    group by
      cb.id,
      cb.name,
      cb.name_kana_or_roman,
      cb.phone,
      cb.email,
      cb.memo
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
