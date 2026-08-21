-- Anonymous customer booking completion.
-- The client estimate is used only to detect a price change. Inventory and
-- prices are recalculated here, and all booking writes share one transaction.

alter table public.reservations
  add column booking_request_id uuid;

alter table public.reservations
  add constraint reservations_booking_request_id_key unique (booking_request_id);

create or replace function public.create_public_reservation(
  p_booking_request_id uuid,
  p_check_in date,
  p_check_out date,
  p_adults integer,
  p_paid_children integer,
  p_free_preschool_children integer,
  p_room_count integer,
  p_room_type_id uuid,
  p_name text,
  p_name_kana_or_roman text,
  p_telephone text,
  p_email text,
  p_expected_check_in_time time,
  p_guest_note text,
  p_expected_total_yen integer
)
returns jsonb
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
  v_room_type public.room_types%rowtype;
  v_existing record;
  v_paid_guests integer := p_adults + p_paid_children;
  v_distribution integer[] := '{}';
  v_free_distribution integer[] := '{}';
  v_base_guests integer;
  v_remainder integer;
  v_free_base integer;
  v_free_remainder integer;
  v_index integer;
  v_active_rooms integer;
  v_available integer;
  v_stay_date date;
  v_room_guests integer;
  v_base_price integer;
  v_price integer;
  v_adjustment_type text;
  v_adjustment_value integer;
  v_is_special boolean;
  v_night_rooms jsonb;
  v_nightly_prices jsonb := '[]'::jsonb;
  v_night_total integer;
  v_total integer := 0;
  v_guest_id uuid;
  v_reservation_id uuid;
  v_reservation_room_id uuid;
  v_reservation_number text;
  v_counter_value integer;
  v_room_total integer;
  v_first_price integer;
begin
  if p_booking_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_BOOKING');
  end if;

  -- Serialize retries with the same request id before checking idempotency.
  perform pg_advisory_xact_lock(hashtextextended(p_booking_request_id::text, 0));

  select
    r.id,
    r.reservation_number,
    r.check_in,
    r.check_out,
    r.adults,
    r.paid_children,
    r.free_preschool_children,
    r.total_amount_yen,
    r.status,
    rt.name_ja as room_type_name,
    count(rr.id)::integer as room_count
  into v_existing
  from public.reservations r
  join public.reservation_rooms rr on rr.reservation_id = r.id
  join public.room_types rt on rt.id = rr.room_type_id
  where r.booking_request_id = p_booking_request_id
  group by r.id, rt.name_ja;

  if found then
    return jsonb_build_object(
      'ok', true,
      'code', 'BOOKING_CONFIRMED',
      'idempotent', true,
      'reservationId', v_existing.id,
      'reservationNumber', v_existing.reservation_number,
      'checkIn', to_char(v_existing.check_in, 'YYYY-MM-DD'),
      'checkOut', to_char(v_existing.check_out, 'YYYY-MM-DD'),
      'roomTypeName', v_existing.room_type_name,
      'roomCount', v_existing.room_count,
      'adults', v_existing.adults,
      'paidChildren', v_existing.paid_children,
      'freePreschoolChildren', v_existing.free_preschool_children,
      'totalAmountYen', v_existing.total_amount_yen,
      'status', v_existing.status
    );
  end if;

  select max_booking_days, max_stay_nights, same_day_booking_cutoff
  into strict v_max_booking_days, v_max_stay_nights, v_cutoff
  from public.hotel_settings
  limit 1;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in
    or p_check_in < v_today
    or p_check_in > v_today + v_max_booking_days
    or p_check_out - p_check_in > v_max_stay_nights
    or (p_check_in = v_today and v_local_time > v_cutoff)
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_BOOKING');
  end if;
  if p_adults is null or p_adults < 1
    or p_paid_children is null or p_paid_children < 0
    or p_free_preschool_children is null or p_free_preschool_children < 0
    or p_room_count is null or p_room_count < 1 or p_room_count > 4
    or v_paid_guests < p_room_count or v_paid_guests > p_room_count * 4
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_BOOKING');
  end if;
  if length(trim(coalesce(p_name, ''))) < 2
    or length(trim(coalesce(p_name, ''))) > 100
    or length(trim(coalesce(p_name_kana_or_roman, ''))) < 2
    or length(trim(coalesce(p_name_kana_or_roman, ''))) > 100
    or length(trim(coalesce(p_telephone, ''))) < 6
    or length(trim(coalesce(p_telephone, ''))) > 40
    or length(trim(coalesce(p_email, ''))) > 254
    or trim(coalesce(p_email, '')) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_expected_check_in_time is null
    or p_expected_check_in_time < time '16:00'
    or p_expected_check_in_time > time '22:00'
    or length(coalesce(p_guest_note, '')) > 1000
    or p_expected_total_yen is null or p_expected_total_yen < 0
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_BOOKING');
  end if;

  select * into v_room_type
  from public.room_types
  where id = p_room_type_id and is_sellable = true
    and code in ('japanese', 'western');
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_BOOKING');
  end if;

  v_base_guests := v_paid_guests / p_room_count;
  v_remainder := v_paid_guests % p_room_count;
  v_free_base := p_free_preschool_children / p_room_count;
  v_free_remainder := p_free_preschool_children % p_room_count;
  for v_index in 1..p_room_count loop
    v_room_guests := v_base_guests + case when v_index <= v_remainder then 1 else 0 end;
    if v_room_guests > least(v_room_type.max_capacity, 4) then
      return jsonb_build_object('ok', false, 'code', 'INVALID_BOOKING');
    end if;
    v_distribution := array_append(v_distribution, v_room_guests);
    v_free_distribution := array_append(
      v_free_distribution,
      v_free_base + case when v_index <= v_free_remainder then 1 else 0 end
    );
  end loop;

  -- Serialize public bookings for this room type so two anonymous requests
  -- cannot both consume the same last sellable room.
  perform pg_advisory_xact_lock(hashtextextended(p_room_type_id::text, 0));

  select count(*)::integer into v_active_rooms
  from public.rooms
  where room_type_id = p_room_type_id and sales_status = 'active';

  for v_stay_date in
    select day::date
    from generate_series(p_check_in, p_check_out - 1, interval '1 day') day
  loop
    select greatest(
      least(coalesce(rti.sellable_quantity, v_active_rooms), v_active_rooms)
      - (
        select count(*)::integer
        from public.reservation_rooms rr
        join public.reservations r on r.id = rr.reservation_id
        where rr.room_type_id = p_room_type_id
          and r.status in ('pending', 'confirmed', 'checked_in')
          and r.check_in <= v_stay_date and v_stay_date < r.check_out
      ),
      0
    )
    into v_available
    from (select 1) singleton
    left join public.room_type_inventory rti
      on rti.room_type_id = p_room_type_id and rti.stay_date = v_stay_date;

    if coalesce(v_available, 0) < p_room_count then
      return jsonb_build_object('ok', false, 'code', 'BOOKING_NO_LONGER_AVAILABLE');
    end if;

    v_night_rooms := '[]'::jsonb;
    v_night_total := 0;
    for v_index in 1..p_room_count loop
      v_room_guests := v_distribution[v_index];

      select rr.price_per_person_yen into v_base_price
      from public.room_rates rr
      where rr.room_type_id = p_room_type_id
        and rr.guest_count = v_room_guests
        and v_stay_date between rr.valid_from and rr.valid_to
      order by rr.valid_from desc
      limit 1;
      if v_base_price is null then
        return jsonb_build_object('ok', false, 'code', 'BOOKING_FAILED');
      end if;

      select ro.price_per_person_yen into v_price
      from public.rate_overrides ro
      where ro.room_type_id = p_room_type_id
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
            v_price := greatest(0, round(v_price * (100 + v_adjustment_value) / 100.0));
          end if;
        end if;
      end if;

      v_night_total := v_night_total + (v_price * v_room_guests);
      v_night_rooms := v_night_rooms || jsonb_build_array(jsonb_build_object(
        'roomIndex', v_index - 1,
        'guestCount', v_room_guests,
        'pricePerPersonYen', v_price,
        'roomTotalYen', v_price * v_room_guests,
        'isSpecialRate', v_is_special
      ));
    end loop;
    v_total := v_total + v_night_total;
    v_nightly_prices := v_nightly_prices || jsonb_build_array(jsonb_build_object(
      'stayDate', to_char(v_stay_date, 'YYYY-MM-DD'),
      'rooms', v_night_rooms,
      'nightTotalYen', v_night_total
    ));
  end loop;

  if v_total <> p_expected_total_yen then
    return jsonb_build_object(
      'ok', false,
      'code', 'PRICE_CHANGED',
      'previousTotalAmountYen', p_expected_total_yen,
      'newTotalAmountYen', v_total,
      'nightlyPrices', v_nightly_prices
    );
  end if;

  insert into public.guests(name, name_kana_or_roman, email, telephone)
  values (
    trim(p_name), trim(p_name_kana_or_roman),
    lower(trim(p_email)), trim(p_telephone)
  )
  returning id into v_guest_id;

  insert into public.reservation_number_counters(counter_date, last_value)
  values (v_today, 1)
  on conflict (counter_date)
  do update set last_value = public.reservation_number_counters.last_value + 1
  returning last_value into v_counter_value;
  v_reservation_number := 'IFH-' || to_char(v_today, 'YYYYMMDD') || '-'
    || lpad(v_counter_value::text, 3, '0');

  insert into public.reservations(
    reservation_number, primary_guest_id, check_in, check_out,
    adults, paid_children, free_preschool_children, status, booking_source,
    expected_check_in_time, guest_note, total_amount_yen, booking_request_id
  ) values (
    v_reservation_number, v_guest_id, p_check_in, p_check_out,
    p_adults, p_paid_children, p_free_preschool_children,
    'confirmed', 'online', p_expected_check_in_time,
    nullif(trim(coalesce(p_guest_note, '')), ''), v_total, p_booking_request_id
  ) returning id into v_reservation_id;

  for v_index in 1..p_room_count loop
    v_room_guests := v_distribution[v_index];
    v_room_total := 0;
    v_first_price := null;

    insert into public.reservation_rooms(
      reservation_id, room_type_id, room_id,
      paid_guest_count, free_preschool_count
    ) values (
      v_reservation_id, p_room_type_id, null,
      v_room_guests, v_free_distribution[v_index]
    ) returning id into v_reservation_room_id;

    for v_stay_date in
      select day::date
      from generate_series(p_check_in, p_check_out - 1, interval '1 day') day
    loop
      select ro.price_per_person_yen into v_price
      from public.rate_overrides ro
      where ro.room_type_id = p_room_type_id
        and ro.guest_count = v_room_guests
        and ro.stay_date = v_stay_date
      limit 1;
      if not found then
        select rr.price_per_person_yen into v_price
        from public.room_rates rr
        where rr.room_type_id = p_room_type_id
          and rr.guest_count = v_room_guests
          and v_stay_date between rr.valid_from and rr.valid_to
        order by rr.valid_from desc
        limit 1;
        select rules.adjustment_type, rules.adjustment_value
        into v_adjustment_type, v_adjustment_value
        from public.rate_rule_dates dates
        join public.rate_rules rules on rules.id = dates.rate_rule_id
        where dates.stay_date = v_stay_date and rules.is_active = true
        limit 1;
        if found then
          if v_adjustment_type = 'fixed_amount' then
            v_price := greatest(0, v_price + v_adjustment_value);
          else
            v_price := greatest(0, round(v_price * (100 + v_adjustment_value) / 100.0));
          end if;
        end if;
      end if;

      v_first_price := coalesce(v_first_price, v_price);
      v_room_total := v_room_total + (v_price * v_room_guests);
      insert into public.reservation_room_nights(
        reservation_room_id, stay_date, price_per_person_yen,
        paid_guest_count, room_total_yen
      ) values (
        v_reservation_room_id, v_stay_date, v_price,
        v_room_guests, v_price * v_room_guests
      );
    end loop;

    update public.reservation_rooms
    set quoted_price_per_person_yen = v_first_price,
        quoted_room_total_yen = v_room_total
    where id = v_reservation_room_id;
  end loop;

  insert into public.payments(reservation_id, method, status, amount_yen)
  values (v_reservation_id, 'pay_at_hotel', 'pending', v_total);

  return jsonb_build_object(
    'ok', true,
    'code', 'BOOKING_CONFIRMED',
    'idempotent', false,
    'reservationId', v_reservation_id,
    'reservationNumber', v_reservation_number,
    'checkIn', to_char(p_check_in, 'YYYY-MM-DD'),
    'checkOut', to_char(p_check_out, 'YYYY-MM-DD'),
    'roomTypeName', v_room_type.name_ja,
    'roomCount', p_room_count,
    'adults', p_adults,
    'paidChildren', p_paid_children,
    'freePreschoolChildren', p_free_preschool_children,
    'totalAmountYen', v_total,
    'status', 'confirmed'
  );
exception
  when others then
    raise warning 'create_public_reservation failed: % (%)', sqlerrm, sqlstate;
    return jsonb_build_object('ok', false, 'code', 'BOOKING_FAILED');
end;
$$;

revoke all on function public.create_public_reservation(
  uuid, date, date, integer, integer, integer, integer, uuid,
  text, text, text, text, time, text, integer
) from public;

grant execute on function public.create_public_reservation(
  uuid, date, date, integer, integer, integer, integer, uuid,
  text, text, text, text, time, text, integer
) to anon, authenticated;
