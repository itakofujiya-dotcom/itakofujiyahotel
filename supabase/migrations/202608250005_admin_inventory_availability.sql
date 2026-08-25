-- Keep customer search and the Admin inventory calendar on one availability
-- calculation. The configured sellable quantity is a ceiling; active
-- reservation_rooms are subtracted for check_in <= stay_date < check_out.

create or replace function public.calculate_room_type_availability(
  p_room_type_id uuid,
  p_stay_date date
)
returns table (
  base_sellable_quantity integer,
  booked_quantity integer,
  available_quantity integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with capacity as (
    select count(*)::integer as active_rooms
    from public.rooms as room
    where room.room_type_id = p_room_type_id
      and room.sales_status = 'active'
  ),
  configured as (
    select inventory.sellable_quantity
    from public.room_type_inventory as inventory
    where inventory.room_type_id = p_room_type_id
      and inventory.stay_date = p_stay_date
  ),
  booked as (
    select count(*)::integer as room_count
    from public.reservation_rooms as reserved_room
    join public.reservations as reservation
      on reservation.id = reserved_room.reservation_id
    where reserved_room.room_type_id = p_room_type_id
      and reservation.status in ('pending', 'confirmed', 'checked_in')
      and reservation.check_in <= p_stay_date
      and p_stay_date < reservation.check_out
  )
  select
    least(
      coalesce(configured.sellable_quantity, capacity.active_rooms),
      capacity.active_rooms
    )::integer as base_sellable_quantity,
    booked.room_count::integer as booked_quantity,
    greatest(
      least(
        coalesce(configured.sellable_quantity, capacity.active_rooms),
        capacity.active_rooms
      ) - booked.room_count,
      0
    )::integer as available_quantity
  from capacity
  cross join booked
  left join configured on true;
$$;

revoke all on function public.calculate_room_type_availability(uuid, date)
from public;

create or replace function public.get_admin_inventory_availability(
  p_start_date date,
  p_end_date date
)
returns table (
  stay_date date,
  room_type_id uuid,
  base_sellable_quantity integer,
  booked_quantity integer,
  available_quantity integer
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
  if p_start_date is null
    or p_end_date is null
    or p_end_date < p_start_date
    or p_end_date - p_start_date > 62
  then
    raise exception 'INVALID_INVENTORY_DATE_RANGE' using errcode = '22023';
  end if;

  return query
  select
    day.value::date,
    room_type.id,
    availability.base_sellable_quantity,
    availability.booked_quantity,
    availability.available_quantity
  from generate_series(
    p_start_date,
    p_end_date,
    interval '1 day'
  ) as day(value)
  cross join public.room_types as room_type
  cross join lateral public.calculate_room_type_availability(
    room_type.id,
    day.value::date
  ) as availability
  where room_type.is_sellable = true
    and room_type.code in ('japanese', 'western')
  order by day.value, room_type.display_order, room_type.code;
end;
$$;

revoke all on function public.get_admin_inventory_availability(date, date)
from public;
grant execute on function public.get_admin_inventory_availability(date, date)
to authenticated;

-- Customer availability continues to include booking-window, capacity, and
-- price validation, while its remaining-room quantity now comes from the same
-- canonical function as the Admin calendar.
create or replace function public.search_available_room_types(
  p_check_in date,
  p_check_out date,
  p_adults integer,
  p_paid_children integer,
  p_free_preschool_children integer,
  p_room_count integer
)
returns table (
  room_type_id uuid,
  room_type_code text,
  room_type_name_ja text,
  available_quantity integer,
  is_available boolean,
  guest_distribution jsonb,
  nightly_prices jsonb,
  min_price_per_person_yen integer,
  estimated_total_yen integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_local_time time := (now() at time zone 'Asia/Tokyo')::time;
  v_max_booking_days integer;
  v_max_stay_nights integer;
  v_cutoff time;
  v_paid_guests integer := p_adults + p_paid_children;
  v_base_guests integer;
  v_remainder integer;
  v_distribution integer[] := '{}';
  v_index integer;
  v_room_type record;
  v_max_distributed_guests integer;
  v_stay_date date;
  v_room_guests integer;
  v_base_price integer;
  v_price integer;
  v_adjustment_type text;
  v_adjustment_value integer;
  v_is_special boolean;
  v_night_rooms jsonb;
  v_night_total integer;
begin
  select max_booking_days, max_stay_nights, same_day_booking_cutoff
  into strict v_max_booking_days, v_max_stay_nights, v_cutoff
  from public.hotel_settings
  limit 1;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'INVALID_STAY_DATES' using errcode = '22023';
  end if;
  if p_check_in < v_today then
    raise exception 'PAST_CHECK_IN' using errcode = '22023';
  end if;
  if p_check_in > v_today + v_max_booking_days then
    raise exception 'BOOKING_WINDOW_EXCEEDED' using errcode = '22023';
  end if;
  if p_check_out - p_check_in > v_max_stay_nights then
    raise exception 'MAX_STAY_EXCEEDED' using errcode = '22023';
  end if;
  if p_check_in = v_today and v_local_time > v_cutoff then
    raise exception 'SAME_DAY_CUTOFF_PASSED' using errcode = '22023';
  end if;
  if p_adults < 1 or p_paid_children < 0 or p_free_preschool_children < 0 then
    raise exception 'INVALID_GUEST_COUNT' using errcode = '22023';
  end if;
  if p_room_count < 1 or p_room_count > 4 then
    raise exception 'INVALID_ROOM_COUNT' using errcode = '22023';
  end if;
  if v_paid_guests < p_room_count or v_paid_guests > p_room_count * 4 then
    raise exception 'GUEST_DISTRIBUTION_NOT_POSSIBLE' using errcode = '22023';
  end if;

  v_base_guests := v_paid_guests / p_room_count;
  v_remainder := v_paid_guests % p_room_count;
  for v_index in 1..p_room_count loop
    v_distribution := array_append(
      v_distribution,
      v_base_guests + case when v_index <= v_remainder then 1 else 0 end
    );
  end loop;
  select max(value) into v_max_distributed_guests
  from unnest(v_distribution) value;

  for v_room_type in
    select id, code, name_ja, max_capacity
    from public.room_types
    where is_sellable = true and code in ('japanese', 'western')
    order by display_order, code
  loop
    room_type_id := v_room_type.id;
    room_type_code := v_room_type.code;
    room_type_name_ja := v_room_type.name_ja;
    guest_distribution := to_jsonb(v_distribution);
    nightly_prices := '[]'::jsonb;
    estimated_total_yen := 0;
    min_price_per_person_yen := null;

    select min(availability.available_quantity)::integer
    into available_quantity
    from generate_series(
      p_check_in,
      p_check_out - 1,
      interval '1 day'
    ) as stay(day)
    cross join lateral public.calculate_room_type_availability(
      v_room_type.id,
      stay.day::date
    ) as availability;

    available_quantity := coalesce(available_quantity, 0);
    is_available := available_quantity >= p_room_count
      and v_max_distributed_guests <= least(v_room_type.max_capacity, 4);

    for v_stay_date in
      select day::date
      from generate_series(p_check_in, p_check_out - 1, interval '1 day') day
    loop
      v_night_rooms := '[]'::jsonb;
      v_night_total := 0;
      for v_index in 1..array_length(v_distribution, 1) loop
        v_room_guests := v_distribution[v_index];

        select rate.price_per_person_yen
        into v_base_price
        from public.room_rates as rate
        where rate.room_type_id = v_room_type.id
          and rate.guest_count = v_room_guests
          and v_stay_date between rate.valid_from and rate.valid_to
        order by rate.valid_from desc
        limit 1;
        if v_base_price is null then
          raise exception 'ROOM_RATE_NOT_FOUND' using errcode = 'P0001';
        end if;

        select override.price_per_person_yen
        into v_price
        from public.rate_overrides as override
        where override.room_type_id = v_room_type.id
          and override.guest_count = v_room_guests
          and override.stay_date = v_stay_date
        limit 1;

        v_is_special := found;
        if not found then
          v_price := v_base_price;
          select rule.adjustment_type, rule.adjustment_value
          into v_adjustment_type, v_adjustment_value
          from public.rate_rule_dates as rule_date
          join public.rate_rules as rule on rule.id = rule_date.rate_rule_id
          where rule_date.stay_date = v_stay_date and rule.is_active = true
          limit 1;
          if found then
            v_is_special := true;
            if v_adjustment_type = 'fixed_amount' then
              v_price := greatest(0, v_price + v_adjustment_value);
            else
              v_price := greatest(
                0,
                round(v_price * (100 + v_adjustment_value) / 100.0)
              );
            end if;
          end if;
        end if;

        min_price_per_person_yen := case
          when min_price_per_person_yen is null then v_price
          else least(min_price_per_person_yen, v_price)
        end;
        v_night_total := v_night_total + (v_price * v_room_guests);
        v_night_rooms := v_night_rooms || jsonb_build_array(
          jsonb_build_object(
            'roomIndex', v_index - 1,
            'guestCount', v_room_guests,
            'pricePerPersonYen', v_price,
            'roomTotalYen', v_price * v_room_guests,
            'isSpecialRate', v_is_special
          )
        );
      end loop;

      estimated_total_yen := estimated_total_yen + v_night_total;
      nightly_prices := nightly_prices || jsonb_build_array(
        jsonb_build_object(
          'stayDate', to_char(v_stay_date, 'YYYY-MM-DD'),
          'rooms', v_night_rooms,
          'nightTotalYen', v_night_total
        )
      );
    end loop;

    min_price_per_person_yen := coalesce(min_price_per_person_yen, 0);
    return next;
  end loop;
end;
$$;

revoke all on function public.search_available_room_types(
  date, date, integer, integer, integer, integer
) from public;
grant execute on function public.search_available_room_types(
  date, date, integer, integer, integer, integer
) to anon, authenticated;
