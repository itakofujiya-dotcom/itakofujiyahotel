-- Public, read-only room-type availability and price estimate.
-- Raw inventory, room, reservation, and guest rows remain inaccessible to anon.

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
  v_active_rooms integer;
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

    select count(*)::integer into v_active_rooms
    from public.rooms
    where rooms.room_type_id = v_room_type.id
      and sales_status = 'active';

    select min(
      greatest(
        least(coalesce(rti.sellable_quantity, v_active_rooms), v_active_rooms)
        - (
          select count(*)::integer
          from public.reservation_rooms rr
          join public.reservations r on r.id = rr.reservation_id
          where rr.room_type_id = v_room_type.id
            and r.status in ('pending', 'confirmed', 'checked_in')
            and r.check_in <= stay.day::date
            and stay.day::date < r.check_out
        ),
        0
      )
    )::integer
    into available_quantity
    from generate_series(p_check_in, p_check_out - 1, interval '1 day') stay(day)
    left join public.room_type_inventory rti
      on rti.room_type_id = v_room_type.id
      and rti.stay_date = stay.day::date;

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

        select rr.price_per_person_yen
        into v_base_price
        from public.room_rates rr
        where rr.room_type_id = v_room_type.id
          and rr.guest_count = v_room_guests
          and v_stay_date between rr.valid_from and rr.valid_to
        order by rr.valid_from desc
        limit 1;
        if v_base_price is null then
          raise exception 'ROOM_RATE_NOT_FOUND' using errcode = 'P0001';
        end if;

        select ro.price_per_person_yen
        into v_price
        from public.rate_overrides ro
        where ro.room_type_id = v_room_type.id
          and ro.guest_count = v_room_guests
          and ro.stay_date = v_stay_date
        limit 1;

        v_is_special := found;
        if not found then
          v_price := v_base_price;
          select rules.adjustment_type, rules.adjustment_value
          into v_adjustment_type, v_adjustment_value
          from public.rate_rule_dates dates
          join public.rate_rules rules on rules.id = dates.rate_rule_id
          where dates.stay_date = v_stay_date and rules.is_active = true
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
