-- Read-only Admin sales reporting over the existing reservation, payment, and
-- cancellation sources of truth. No accounting data is duplicated or stored.

create or replace function public.get_admin_sales_summary(
  p_start_date date,
  p_end_date date,
  p_payment_method text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'INVALID_SALES_DATE_RANGE' using errcode = '22023';
  end if;
  if p_payment_method is not null
    and p_payment_method not in ('pay_at_hotel', 'bank_transfer', 'card')
  then
    raise exception 'INVALID_PAYMENT_METHOD' using errcode = '22023';
  end if;

  with payment_snapshot as (
    select
      reservation.id,
      reservation.status as reservation_status,
      reservation.check_out as revenue_date,
      (reservation.cancelled_at at time zone 'Asia/Tokyo')::date as cancellation_date,
      coalesce(reservation.total_amount_yen, 0)::bigint as reservation_amount_yen,
      coalesce(reservation.cancellation_fee_yen, 0)::bigint as cancellation_fee_yen,
      coalesce(payment.payment_count, 0) as payment_count,
      payment.method as payment_method,
      payment.status as payment_status,
      coalesce(payment.amount_yen, 0)::bigint as payment_amount_yen,
      (payment.paid_at at time zone 'Asia/Tokyo')::date as payment_date
    from public.reservations as reservation
    left join lateral (
      select
        count(*)::integer as payment_count,
        (array_agg(p.method order by p.created_at, p.id))[1] as method,
        (array_agg(p.status order by p.created_at, p.id))[1] as status,
        (array_agg(p.amount_yen order by p.created_at, p.id))[1] as amount_yen,
        (array_agg(p.paid_at order by p.created_at, p.id))[1] as paid_at
      from public.payments as p
      where p.reservation_id = reservation.id
    ) as payment on true
  ), scoped as (
    select snapshot.*
    from payment_snapshot as snapshot
    where p_payment_method is null
      or (
        snapshot.payment_count = 1
        and snapshot.payment_method = p_payment_method
      )
  ), totals as (
    select
      coalesce(sum(s.reservation_amount_yen) filter (
        where s.reservation_status not in ('cancelled', 'no_show')
          and s.revenue_date between p_start_date and p_end_date
      ), 0)::bigint as reservation_revenue_yen,
      coalesce(sum(s.payment_amount_yen) filter (
        where s.payment_count = 1
          and s.payment_status = 'paid'
          and s.reservation_status not in ('cancelled', 'no_show')
          and s.payment_date between p_start_date and p_end_date
      ), 0)::bigint as collected_yen,
      count(*) filter (
        where s.reservation_status not in ('cancelled', 'no_show')
          and s.revenue_date between p_start_date and p_end_date
      )::bigint as reservation_count,
      count(*) filter (
        where s.reservation_status = 'checked_out'
          and s.revenue_date between p_start_date and p_end_date
      )::bigint as completed_stay_count,
      coalesce(sum(s.cancellation_fee_yen) filter (
        where s.reservation_status in ('cancelled', 'no_show')
          and s.cancellation_date between p_start_date and p_end_date
      ), 0)::bigint as cancellation_fee_yen,
      coalesce(sum(greatest(s.payment_amount_yen - s.cancellation_fee_yen, 0)) filter (
        where s.payment_count = 1
          and s.payment_status = 'paid'
          and s.reservation_status in ('cancelled', 'no_show')
          and s.cancellation_date between p_start_date and p_end_date
      ), 0)::bigint as refund_target_yen
    from scoped as s
  ), payment_methods(method, display_order) as (
    values
      ('pay_at_hotel'::text, 1),
      ('bank_transfer'::text, 2),
      ('card'::text, 3)
  ), method_totals as (
    select
      method.method,
      method.display_order,
      coalesce(sum(s.reservation_amount_yen) filter (
        where s.payment_count = 1
          and s.reservation_status not in ('cancelled', 'no_show')
          and s.revenue_date between p_start_date and p_end_date
      ), 0)::bigint as reservation_revenue_yen,
      coalesce(sum(s.payment_amount_yen) filter (
        where s.payment_count = 1
          and s.payment_status = 'paid'
          and s.reservation_status not in ('cancelled', 'no_show')
          and s.payment_date between p_start_date and p_end_date
      ), 0)::bigint as collected_yen,
      count(s.id) filter (
        where s.payment_count = 1
          and s.reservation_status not in ('cancelled', 'no_show')
          and s.revenue_date between p_start_date and p_end_date
      )::bigint as reservation_count
    from payment_methods as method
    left join scoped as s on s.payment_method = method.method
    where p_payment_method is null or method.method = p_payment_method
    group by method.method, method.display_order
  )
  select jsonb_build_object(
    'reservationRevenueYen', totals.reservation_revenue_yen,
    'collectedYen', totals.collected_yen,
    'reservationCount', totals.reservation_count,
    'completedStayCount', totals.completed_stay_count,
    'cancellationFeeYen', totals.cancellation_fee_yen,
    'refundTargetYen', totals.refund_target_yen,
    'paymentMethods', coalesce((
      select jsonb_agg(jsonb_build_object(
        'method', method_total.method,
        'reservationRevenueYen', method_total.reservation_revenue_yen,
        'collectedYen', method_total.collected_yen,
        'reservationCount', method_total.reservation_count
      ) order by method_total.display_order)
      from method_totals as method_total
    ), '[]'::jsonb)
  ) into v_result
  from totals;

  return v_result;
end;
$$;

revoke all on function public.get_admin_sales_summary(date, date, text)
from public;
grant execute on function public.get_admin_sales_summary(date, date, text)
to authenticated;

create or replace function public.get_admin_sales_details(
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
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  -- Normal UI requests use 30 rows. The higher ceiling is reserved for the
  -- explicit print action so the report can include the full selected period.
  v_page_size integer := least(greatest(coalesce(p_page_size, 30), 1), 5000);
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'INVALID_SALES_DATE_RANGE' using errcode = '22023';
  end if;
  if p_payment_method is not null
    and p_payment_method not in ('pay_at_hotel', 'bank_transfer', 'card')
  then
    raise exception 'INVALID_PAYMENT_METHOD' using errcode = '22023';
  end if;
  if p_status_filter not in ('all', 'normal', 'cancelled', 'completed') then
    raise exception 'INVALID_SALES_STATUS_FILTER' using errcode = '22023';
  end if;
  if p_sort not in ('latest', 'oldest', 'amount') then
    raise exception 'INVALID_SALES_SORT' using errcode = '22023';
  end if;

  return query
  with reservation_snapshot as (
    select
      reservation.id,
      reservation.reservation_number,
      guest.name as guest_name,
      reservation.check_in,
      reservation.check_out,
      reservation.status as reservation_status,
      (reservation.cancelled_at at time zone 'Asia/Tokyo')::date as cancellation_date,
      coalesce(reservation.total_amount_yen, 0)::bigint as reservation_amount_yen,
      coalesce(reservation.cancellation_fee_yen, 0)::bigint as cancellation_fee_yen,
      coalesce(payment.payment_count, 0) as payment_count,
      payment.method as payment_method,
      payment.status as payment_status,
      coalesce(payment.amount_yen, 0)::bigint as payment_amount_yen,
      (payment.paid_at at time zone 'Asia/Tokyo')::date as payment_date,
      coalesce(room_summary.rooms, '[]'::jsonb) as rooms
    from public.reservations as reservation
    join public.guests as guest on guest.id = reservation.primary_guest_id
    left join lateral (
      select
        count(*)::integer as payment_count,
        (array_agg(p.method order by p.created_at, p.id))[1] as method,
        (array_agg(p.status order by p.created_at, p.id))[1] as status,
        (array_agg(p.amount_yen order by p.created_at, p.id))[1] as amount_yen,
        (array_agg(p.paid_at order by p.created_at, p.id))[1] as paid_at
      from public.payments as p
      where p.reservation_id = reservation.id
    ) as payment on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'roomTypeNameJa', grouped_room.name_ja,
        'roomCount', grouped_room.room_count
      ) order by grouped_room.display_order, grouped_room.name_ja) as rooms
      from (
        select
          room_type.name_ja,
          room_type.display_order,
          count(*)::integer as room_count
        from public.reservation_rooms as reserved_room
        join public.room_types as room_type
          on room_type.id = reserved_room.room_type_id
        where reserved_room.reservation_id = reservation.id
        group by room_type.id, room_type.name_ja, room_type.display_order
      ) as grouped_room
    ) as room_summary on true
  ), calculated as (
    select
      snapshot.*,
      snapshot.reservation_status not in ('cancelled', 'no_show')
        and snapshot.check_out between p_start_date and p_end_date
        as has_revenue_event,
      snapshot.payment_count = 1
        and snapshot.payment_status = 'paid'
        and snapshot.reservation_status not in ('cancelled', 'no_show')
        and snapshot.payment_date between p_start_date and p_end_date
        as has_collection_event,
      snapshot.reservation_status in ('cancelled', 'no_show')
        and snapshot.cancellation_date between p_start_date and p_end_date
        as has_cancellation_event
    from reservation_snapshot as snapshot
    where p_payment_method is null
      or (
        snapshot.payment_count = 1
        and snapshot.payment_method = p_payment_method
      )
  ), eligible as (
    select calculated.*
    from calculated
    where (
      calculated.has_revenue_event
      or calculated.has_collection_event
      or calculated.has_cancellation_event
    )
      and (
        p_status_filter = 'all'
        or (p_status_filter = 'normal' and calculated.reservation_status not in ('cancelled', 'no_show'))
        or (p_status_filter = 'cancelled' and calculated.reservation_status in ('cancelled', 'no_show'))
        or (p_status_filter = 'completed' and calculated.reservation_status = 'checked_out')
      )
  )
  select
    e.id,
    case
      when e.has_cancellation_event then e.cancellation_date
      when e.has_revenue_event then e.check_out
      else e.payment_date
    end as event_date,
    e.reservation_number,
    e.guest_name,
    e.check_in,
    e.check_out,
    e.rooms,
    case when e.payment_count = 1 then e.payment_method else null end,
    case when e.payment_count = 1 then e.payment_status else null end,
    e.reservation_status,
    e.reservation_amount_yen,
    case when e.has_revenue_event then e.reservation_amount_yen else 0 end,
    case when e.has_collection_event then e.payment_amount_yen else 0 end,
    case when e.has_cancellation_event then e.cancellation_fee_yen else 0 end,
    case
      when e.has_cancellation_event
        and e.payment_count = 1
        and e.payment_status = 'paid'
      then greatest(e.payment_amount_yen - e.cancellation_fee_yen, 0)
      else 0
    end,
    case
      when e.payment_count = 0 then 'missing'
      when e.payment_count > 1 then 'multiple'
      else null
    end,
    count(*) over()
  from eligible as e
  order by
    case when p_sort = 'latest' then
      case
        when e.has_cancellation_event then e.cancellation_date
        when e.has_revenue_event then e.check_out
        else e.payment_date
      end
    end desc,
    case when p_sort = 'oldest' then
      case
        when e.has_cancellation_event then e.cancellation_date
        when e.has_revenue_event then e.check_out
        else e.payment_date
      end
    end asc,
    case when p_sort = 'amount' then e.reservation_amount_yen end desc,
    e.reservation_number desc,
    e.id
  limit v_page_size
  offset (v_page - 1) * v_page_size;
end;
$$;

revoke all on function public.get_admin_sales_details(
  date, date, text, text, text, integer, integer
) from public;
grant execute on function public.get_admin_sales_details(
  date, date, text, text, text, integer, integer
) to authenticated;
