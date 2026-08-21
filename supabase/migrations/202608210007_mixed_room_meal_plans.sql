-- Mixed-room public bookings and room-level meal-plan snapshots.
-- Existing public booking RPCs remain available for backward compatibility.

alter table public.reservation_rooms
  add column adult_guest_count smallint,
  add column paid_child_count smallint,
  add column meal_plan text not null default 'breakfast',
  add column meal_surcharge_yen integer not null default 0;

update public.reservation_rooms
set adult_guest_count = paid_guest_count,
    paid_child_count = 0
where adult_guest_count is null or paid_child_count is null;

alter table public.reservation_rooms
  alter column adult_guest_count set not null,
  alter column paid_child_count set not null,
  add constraint reservation_rooms_adult_guest_count_check
    check (adult_guest_count between 1 and 4),
  add constraint reservation_rooms_paid_child_count_check
    check (paid_child_count >= 0),
  add constraint reservation_rooms_paid_guest_breakdown_check
    check (adult_guest_count + paid_child_count = paid_guest_count),
  add constraint reservation_rooms_meal_plan_check
    check (meal_plan in ('breakfast', 'breakfast_dinner')),
  add constraint reservation_rooms_meal_surcharge_yen_check
    check (meal_surcharge_yen >= 0);

-- Keep the legacy public RPC compatible: it only supplies paid_guest_count.
create or replace function public.fill_reservation_room_guest_breakdown()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.adult_guest_count := coalesce(new.adult_guest_count, new.paid_guest_count);
  new.paid_child_count := coalesce(new.paid_child_count, 0);
  return new;
end;
$$;

create trigger fill_reservation_room_guest_breakdown_before_insert
before insert on public.reservation_rooms
for each row execute function public.fill_reservation_room_guest_breakdown();

comment on column public.reservation_rooms.meal_plan is
  'Room-level meal plan snapshot: breakfast or breakfast_dinner.';
comment on column public.reservation_rooms.meal_surcharge_yen is
  'Server-calculated meal surcharge snapshot included in quoted_room_total_yen.';

create or replace function public.search_public_mixed_booking(
  p_check_in date,
  p_check_out date,
  p_rooms jsonb
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
  v_room jsonb;
  v_room_index integer;
  v_room_type public.room_types%rowtype;
  v_room_type_id uuid;
  v_adults integer;
  v_paid_children integer;
  v_free_preschool integer;
  v_paid_guests integer;
  v_meal_plan text;
  v_required record;
  v_active_rooms integer;
  v_available integer;
  v_stay_date date;
  v_base_price integer;
  v_price integer;
  v_adjustment_type text;
  v_adjustment_value integer;
  v_is_special boolean;
  v_nightly jsonb;
  v_room_base_total integer;
  v_meal_surcharge integer;
  v_room_subtotal integer;
  v_total integer := 0;
  v_result_rooms jsonb := '[]'::jsonb;
begin
  select hs.max_booking_days, hs.max_stay_nights, hs.same_day_booking_cutoff
  into strict v_max_booking_days, v_max_stay_nights, v_cutoff
  from public.hotel_settings as hs
  limit 1;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in
    or p_check_in < v_today
    or p_check_in > v_today + v_max_booking_days
    or p_check_out - p_check_in > v_max_stay_nights
    or (p_check_in = v_today and v_local_time > v_cutoff)
    or p_rooms is null
    or jsonb_typeof(p_rooms) <> 'array'
    or jsonb_array_length(p_rooms) < 1
    or jsonb_array_length(p_rooms) > 4
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_BOOKING');
  end if;

  -- Validate every room before checking inventory or calculating a quote.
  for v_room, v_room_index in
    select item.value, item.ordinality::integer - 1
    from jsonb_array_elements(p_rooms) with ordinality as item(value, ordinality)
  loop
    begin
      v_room_type_id := (v_room->>'room_type_id')::uuid;
      v_adults := (v_room->>'adult_guest_count')::integer;
      v_paid_children := coalesce((v_room->>'paid_child_count')::integer, 0);
      v_free_preschool := coalesce((v_room->>'free_preschool_count')::integer, 0);
      v_meal_plan := v_room->>'meal_plan';
    exception when others then
      return jsonb_build_object('ok', false, 'code', 'INVALID_BOOKING');
    end;

    v_paid_guests := v_adults + v_paid_children;
    select rt.* into v_room_type
    from public.room_types as rt
    where rt.id = v_room_type_id
      and rt.is_sellable = true
      and rt.code in ('japanese', 'western');

    if not found
      or v_adults < 1 or v_paid_children < 0 or v_free_preschool < 0
      or v_paid_guests < 1 or v_paid_guests > least(v_room_type.max_capacity, 4)
      or v_meal_plan is null
      or v_meal_plan not in ('breakfast', 'breakfast_dinner')
    then
      return jsonb_build_object('ok', false, 'code', 'INVALID_BOOKING');
    end if;
  end loop;

  -- Aggregate requested quantities by type. Mixed bookings must be all-or-nothing.
  for v_required in
    select (item.value->>'room_type_id')::uuid as room_type_id,
           count(*)::integer as quantity
    from jsonb_array_elements(p_rooms) as item(value)
    group by (item.value->>'room_type_id')::uuid
  loop
    select count(*)::integer into v_active_rooms
    from public.rooms as physical_room
    where physical_room.room_type_id = v_required.room_type_id
      and physical_room.sales_status = 'active';

    for v_stay_date in
      select day::date
      from generate_series(p_check_in, p_check_out - 1, interval '1 day') as day
    loop
      select greatest(
        least(coalesce(inventory.sellable_quantity, v_active_rooms), v_active_rooms)
        - (
          select count(*)::integer
          from public.reservation_rooms as reserved_room
          join public.reservations as reservation
            on reservation.id = reserved_room.reservation_id
          where reserved_room.room_type_id = v_required.room_type_id
            and reservation.status in ('pending', 'confirmed', 'checked_in')
            and reservation.check_in <= v_stay_date
            and v_stay_date < reservation.check_out
        ),
        0
      ) into v_available
      from (select 1) as singleton
      left join public.room_type_inventory as inventory
        on inventory.room_type_id = v_required.room_type_id
       and inventory.stay_date = v_stay_date;

      if coalesce(v_available, 0) < v_required.quantity then
        return jsonb_build_object('ok', false, 'code', 'BOOKING_NO_LONGER_AVAILABLE');
      end if;
    end loop;
  end loop;

  for v_room, v_room_index in
    select item.value, item.ordinality::integer - 1
    from jsonb_array_elements(p_rooms) with ordinality as item(value, ordinality)
  loop
    v_room_type_id := (v_room->>'room_type_id')::uuid;
    v_adults := (v_room->>'adult_guest_count')::integer;
    v_paid_children := coalesce((v_room->>'paid_child_count')::integer, 0);
    v_free_preschool := coalesce((v_room->>'free_preschool_count')::integer, 0);
    v_paid_guests := v_adults + v_paid_children;
    v_meal_plan := v_room->>'meal_plan';
    select rt.* into strict v_room_type
    from public.room_types as rt where rt.id = v_room_type_id;
    v_nightly := '[]'::jsonb;
    v_room_base_total := 0;

    for v_stay_date in
      select day::date
      from generate_series(p_check_in, p_check_out - 1, interval '1 day') as day
    loop
      select rate.price_per_person_yen into v_base_price
      from public.room_rates as rate
      where rate.room_type_id = v_room_type_id
        and rate.guest_count = v_paid_guests
        and v_stay_date between rate.valid_from and rate.valid_to
      order by rate.valid_from desc
      limit 1;
      if v_base_price is null then
        return jsonb_build_object('ok', false, 'code', 'BOOKING_FAILED');
      end if;

      select override.price_per_person_yen into v_price
      from public.rate_overrides as override
      where override.room_type_id = v_room_type_id
        and override.guest_count = v_paid_guests
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
            v_price := greatest(0, round(v_price * (100 + v_adjustment_value) / 100.0));
          end if;
        end if;
      end if;

      v_room_base_total := v_room_base_total + (v_price * v_paid_guests);
      v_nightly := v_nightly || jsonb_build_array(jsonb_build_object(
        'stayDate', to_char(v_stay_date, 'YYYY-MM-DD'),
        'guestCount', v_paid_guests,
        'pricePerPersonYen', v_price,
        'roomTotalYen', v_price * v_paid_guests,
        'isSpecialRate', v_is_special
      ));
    end loop;

    v_meal_surcharge := case when v_meal_plan = 'breakfast_dinner'
      then v_adults * (p_check_out - p_check_in) * 2000 else 0 end;
    v_room_subtotal := v_room_base_total + v_meal_surcharge;
    v_total := v_total + v_room_subtotal;
    v_result_rooms := v_result_rooms || jsonb_build_array(jsonb_build_object(
      'roomIndex', v_room_index,
      'roomTypeId', v_room_type.id,
      'roomTypeCode', v_room_type.code,
      'roomTypeNameJa', v_room_type.name_ja,
      'adultGuestCount', v_adults,
      'paidChildCount', v_paid_children,
      'freePreschoolCount', v_free_preschool,
      'mealPlan', v_meal_plan,
      'nightlyPrices', v_nightly,
      'baseRoomTotalYen', v_room_base_total,
      'mealSurchargeYen', v_meal_surcharge,
      'subtotalYen', v_room_subtotal
    ));
  end loop;

  return jsonb_build_object(
    'ok', true,
    'code', 'QUOTE_AVAILABLE',
    'rooms', v_result_rooms,
    'totalAmountYen', v_total
  );
exception when others then
  raise warning 'search_public_mixed_booking failed: % (%)', sqlerrm, sqlstate;
  return jsonb_build_object('ok', false, 'code', 'BOOKING_FAILED');
end;
$$;

revoke all on function public.search_public_mixed_booking(date, date, jsonb) from public;
grant execute on function public.search_public_mixed_booking(date, date, jsonb)
to anon, authenticated;

create or replace function public.create_public_mixed_reservation(
  p_booking_request_id uuid,
  p_check_in date,
  p_check_out date,
  p_rooms jsonb,
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
  v_existing public.reservations%rowtype;
  v_quote jsonb;
  v_room jsonb;
  v_night jsonb;
  v_type_id uuid;
  v_guest_id uuid;
  v_reservation_id uuid;
  v_reservation_room_id uuid;
  v_reservation_number text;
  v_counter_value integer;
  v_adults integer := 0;
  v_paid_children integer := 0;
  v_free_preschool integer := 0;
  v_completion_rooms jsonb;
begin
  if p_booking_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_BOOKING');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_booking_request_id::text, 0));

  select reservation.* into v_existing
  from public.reservations as reservation
  where reservation.booking_request_id = p_booking_request_id;
  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'roomIndex', stored.ordinality - 1,
      'roomTypeId', room_type.id,
      'roomTypeCode', room_type.code,
      'roomTypeNameJa', room_type.name_ja,
      'adultGuestCount', stored.adult_guest_count,
      'paidChildCount', stored.paid_child_count,
      'freePreschoolCount', stored.free_preschool_count,
      'mealPlan', stored.meal_plan,
      'nightlyPrices', coalesce((
        select jsonb_agg(jsonb_build_object(
          'stayDate', to_char(night.stay_date, 'YYYY-MM-DD'),
          'guestCount', night.paid_guest_count,
          'pricePerPersonYen', night.price_per_person_yen,
          'roomTotalYen', night.room_total_yen,
          'isSpecialRate', false
        ) order by night.stay_date)
        from public.reservation_room_nights as night
        where night.reservation_room_id = stored.id
      ), '[]'::jsonb),
      'baseRoomTotalYen', stored.quoted_room_total_yen - stored.meal_surcharge_yen,
      'mealSurchargeYen', stored.meal_surcharge_yen,
      'subtotalYen', stored.quoted_room_total_yen
    ) order by stored.ordinality), '[]'::jsonb)
    into v_completion_rooms
    from (
      select rr.*, row_number() over (order by rr.created_at, rr.id)::integer as ordinality
      from public.reservation_rooms as rr
      where rr.reservation_id = v_existing.id
    ) as stored
    join public.room_types as room_type on room_type.id = stored.room_type_id;

    return jsonb_build_object(
      'ok', true, 'code', 'BOOKING_CONFIRMED', 'idempotent', true,
      'reservationId', v_existing.id,
      'reservationNumber', v_existing.reservation_number,
      'checkIn', to_char(v_existing.check_in, 'YYYY-MM-DD'),
      'checkOut', to_char(v_existing.check_out, 'YYYY-MM-DD'),
      'roomCount', jsonb_array_length(v_completion_rooms),
      'adults', v_existing.adults,
      'paidChildren', v_existing.paid_children,
      'freePreschoolChildren', v_existing.free_preschool_children,
      'totalAmountYen', v_existing.total_amount_yen,
      'rooms', v_completion_rooms,
      'status', v_existing.status
    );
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
    or p_expected_check_in_time < time '15:00'
    or p_expected_check_in_time > time '22:00'
    or length(coalesce(p_guest_note, '')) > 1000
    or p_expected_total_yen is null or p_expected_total_yen < 0
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_BOOKING');
  end if;

  -- Lock all requested room types in deterministic order before rechecking stock.
  for v_type_id in
    select distinct (item.value->>'room_type_id')::uuid
    from jsonb_array_elements(p_rooms) as item(value)
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_type_id::text, 0));
  end loop;

  v_quote := public.search_public_mixed_booking(p_check_in, p_check_out, p_rooms);
  if coalesce((v_quote->>'ok')::boolean, false) is not true then
    return v_quote;
  end if;
  if (v_quote->>'totalAmountYen')::integer <> p_expected_total_yen then
    return jsonb_build_object(
      'ok', false, 'code', 'PRICE_CHANGED',
      'previousTotalAmountYen', p_expected_total_yen,
      'newTotalAmountYen', (v_quote->>'totalAmountYen')::integer,
      'rooms', v_quote->'rooms'
    );
  end if;

  for v_room in select value from jsonb_array_elements(v_quote->'rooms')
  loop
    v_adults := v_adults + (v_room->>'adultGuestCount')::integer;
    v_paid_children := v_paid_children + (v_room->>'paidChildCount')::integer;
    v_free_preschool := v_free_preschool + (v_room->>'freePreschoolCount')::integer;
  end loop;

  insert into public.guests(name, name_kana_or_roman, email, telephone)
  values (trim(p_name), trim(p_name_kana_or_roman), lower(trim(p_email)), trim(p_telephone))
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
    v_adults, v_paid_children, v_free_preschool, 'confirmed', 'online',
    p_expected_check_in_time, nullif(trim(coalesce(p_guest_note, '')), ''),
    (v_quote->>'totalAmountYen')::integer, p_booking_request_id
  ) returning id into v_reservation_id;

  for v_room in select value from jsonb_array_elements(v_quote->'rooms')
  loop
    insert into public.reservation_rooms(
      reservation_id, room_type_id, room_id, paid_guest_count,
      adult_guest_count, paid_child_count, free_preschool_count,
      meal_plan, meal_surcharge_yen, quoted_price_per_person_yen,
      quoted_room_total_yen
    ) values (
      v_reservation_id, (v_room->>'roomTypeId')::uuid, null,
      (v_room->>'adultGuestCount')::integer + (v_room->>'paidChildCount')::integer,
      (v_room->>'adultGuestCount')::integer,
      (v_room->>'paidChildCount')::integer,
      (v_room->>'freePreschoolCount')::integer,
      v_room->>'mealPlan', (v_room->>'mealSurchargeYen')::integer,
      ((v_room->'nightlyPrices'->0)->>'pricePerPersonYen')::integer,
      (v_room->>'subtotalYen')::integer
    ) returning id into v_reservation_room_id;

    for v_night in select value from jsonb_array_elements(v_room->'nightlyPrices')
    loop
      insert into public.reservation_room_nights(
        reservation_room_id, stay_date, price_per_person_yen,
        paid_guest_count, room_total_yen
      ) values (
        v_reservation_room_id, (v_night->>'stayDate')::date,
        (v_night->>'pricePerPersonYen')::integer,
        (v_night->>'guestCount')::integer,
        (v_night->>'roomTotalYen')::integer
      );
    end loop;
  end loop;

  insert into public.payments(reservation_id, method, status, amount_yen)
  values (v_reservation_id, 'pay_at_hotel', 'pending', (v_quote->>'totalAmountYen')::integer);

  return jsonb_build_object(
    'ok', true, 'code', 'BOOKING_CONFIRMED', 'idempotent', false,
    'reservationId', v_reservation_id, 'reservationNumber', v_reservation_number,
    'checkIn', to_char(p_check_in, 'YYYY-MM-DD'),
    'checkOut', to_char(p_check_out, 'YYYY-MM-DD'),
    'roomCount', jsonb_array_length(v_quote->'rooms'),
    'adults', v_adults, 'paidChildren', v_paid_children,
    'freePreschoolChildren', v_free_preschool,
    'totalAmountYen', (v_quote->>'totalAmountYen')::integer,
    'rooms', v_quote->'rooms', 'status', 'confirmed'
  );
exception when others then
  raise warning 'create_public_mixed_reservation failed: % (%)', sqlerrm, sqlstate;
  return jsonb_build_object('ok', false, 'code', 'BOOKING_FAILED');
end;
$$;

revoke all on function public.create_public_mixed_reservation(
  uuid, date, date, jsonb, text, text, text, text, time, text, integer
) from public;
grant execute on function public.create_public_mixed_reservation(
  uuid, date, date, jsonb, text, text, text, text, time, text, integer
) to anon, authenticated;

-- Extend the existing admin RPC input with room-level guest breakdown and meal plan.
create or replace function public.create_admin_reservation(
  p_guest jsonb,
  p_reservation jsonb,
  p_rooms jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_id uuid;
  v_reservation_id uuid;
  v_reservation_room_id uuid;
  v_room jsonb;
  v_stay_date date;
  v_check_in date := (p_reservation->>'check_in')::date;
  v_check_out date := (p_reservation->>'check_out')::date;
  v_adults integer;
  v_paid_children integer;
  v_paid_guest_count integer;
  v_free_count integer;
  v_meal_plan text;
  v_meal_surcharge integer;
  v_max_capacity integer;
  v_base_price integer;
  v_price integer;
  v_first_price integer;
  v_room_total integer;
  v_total integer := 0;
  v_total_adults integer := 0;
  v_total_paid_children integer := 0;
  v_total_free_guests integer := 0;
  v_adjustment_type text;
  v_adjustment_value integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if v_check_out <= v_check_in or v_check_out > v_check_in + 10 then
    raise exception 'INVALID_STAY_DATES' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rooms) <> 'array' or jsonb_array_length(p_rooms) < 1 or jsonb_array_length(p_rooms) > 4 then
    raise exception 'INVALID_ROOM_COUNT' using errcode = '22023';
  end if;
  if p_reservation->>'booking_source' not in ('phone', 'walk_in', 'admin') then
    raise exception 'INVALID_BOOKING_SOURCE' using errcode = '22023';
  end if;

  for v_room in select value from jsonb_array_elements(p_rooms)
  loop
    v_adults := coalesce((v_room->>'adult_guest_count')::integer, (v_room->>'paid_guest_count')::integer);
    v_paid_children := coalesce((v_room->>'paid_child_count')::integer, 0);
    v_paid_guest_count := v_adults + v_paid_children;
    v_free_count := coalesce((v_room->>'free_preschool_count')::integer, 0);
    v_meal_plan := coalesce(v_room->>'meal_plan', 'breakfast');
    select rt.max_capacity into v_max_capacity
    from public.room_types as rt
    where rt.id = (v_room->>'room_type_id')::uuid and rt.is_sellable = true;
    if v_adults < 1 or v_paid_children < 0 or v_paid_guest_count not between 1 and 4
      or v_free_count < 0 or v_meal_plan not in ('breakfast', 'breakfast_dinner')
      or v_max_capacity is null or v_paid_guest_count > least(v_max_capacity, 4) then
      raise exception 'INVALID_GUEST_OR_MEAL_PLAN' using errcode = '22023';
    end if;
    v_total_adults := v_total_adults + v_adults;
    v_total_paid_children := v_total_paid_children + v_paid_children;
    v_total_free_guests := v_total_free_guests + v_free_count;
  end loop;

  insert into public.guests(name, name_kana_or_roman, email, telephone, nationality, postal_code, address)
  values (trim(p_guest->>'name'), nullif(trim(p_guest->>'name_kana_or_roman'), ''),
    trim(p_guest->>'email'), trim(p_guest->>'telephone'), nullif(trim(p_guest->>'nationality'), ''),
    nullif(trim(p_guest->>'postal_code'), ''), nullif(trim(p_guest->>'address'), ''))
  returning id into v_guest_id;

  insert into public.reservations(
    reservation_number, primary_guest_id, check_in, check_out, adults,
    paid_children, free_preschool_children, status, booking_source,
    expected_check_in_time, guest_note, admin_note, total_amount_yen
  ) values (
    public.next_admin_reservation_number(), v_guest_id, v_check_in, v_check_out,
    v_total_adults, v_total_paid_children, v_total_free_guests, 'confirmed',
    p_reservation->>'booking_source', nullif(p_reservation->>'expected_check_in_time', '')::time,
    nullif(trim(p_reservation->>'guest_note'), ''), nullif(trim(p_reservation->>'admin_note'), ''), 0
  ) returning id into v_reservation_id;

  for v_room in select value from jsonb_array_elements(p_rooms)
  loop
    v_adults := coalesce((v_room->>'adult_guest_count')::integer, (v_room->>'paid_guest_count')::integer);
    v_paid_children := coalesce((v_room->>'paid_child_count')::integer, 0);
    v_paid_guest_count := v_adults + v_paid_children;
    v_free_count := coalesce((v_room->>'free_preschool_count')::integer, 0);
    v_meal_plan := coalesce(v_room->>'meal_plan', 'breakfast');
    v_meal_surcharge := case when v_meal_plan = 'breakfast_dinner'
      then v_adults * (v_check_out - v_check_in) * 2000 else 0 end;
    v_room_total := 0;
    v_first_price := null;

    insert into public.reservation_rooms(
      reservation_id, room_type_id, paid_guest_count, adult_guest_count,
      paid_child_count, free_preschool_count, meal_plan, meal_surcharge_yen
    ) values (
      v_reservation_id, (v_room->>'room_type_id')::uuid, v_paid_guest_count,
      v_adults, v_paid_children, v_free_count, v_meal_plan, v_meal_surcharge
    ) returning id into v_reservation_room_id;

    for v_stay_date in select day::date from generate_series(v_check_in, v_check_out - 1, interval '1 day') as day
    loop
      select rate.price_per_person_yen into v_base_price
      from public.room_rates as rate
      where rate.room_type_id = (v_room->>'room_type_id')::uuid
        and rate.guest_count = v_paid_guest_count
        and v_stay_date between rate.valid_from and rate.valid_to
      order by rate.valid_from desc limit 1;
      if v_base_price is null then raise exception 'ROOM_RATE_NOT_FOUND:%', v_stay_date using errcode = 'P0001'; end if;
      select override.price_per_person_yen into v_price
      from public.rate_overrides as override
      where override.room_type_id = (v_room->>'room_type_id')::uuid
        and override.guest_count = v_paid_guest_count and override.stay_date = v_stay_date limit 1;
      if not found then
        v_price := v_base_price;
        select rule.adjustment_type, rule.adjustment_value into v_adjustment_type, v_adjustment_value
        from public.rate_rule_dates as rule_date
        join public.rate_rules as rule on rule.id = rule_date.rate_rule_id
        where rule_date.stay_date = v_stay_date and rule.is_active = true limit 1;
        if found then
          if v_adjustment_type = 'fixed_amount' then v_price := greatest(0, v_price + v_adjustment_value);
          else v_price := greatest(0, round(v_price * (100 + v_adjustment_value) / 100.0)); end if;
        end if;
      end if;
      v_first_price := coalesce(v_first_price, v_price);
      v_room_total := v_room_total + (v_price * v_paid_guest_count);
      insert into public.reservation_room_nights(
        reservation_room_id, stay_date, price_per_person_yen, paid_guest_count, room_total_yen
      ) values (v_reservation_room_id, v_stay_date, v_price, v_paid_guest_count, v_price * v_paid_guest_count);
    end loop;
    v_room_total := v_room_total + v_meal_surcharge;
    update public.reservation_rooms
    set quoted_price_per_person_yen = v_first_price, quoted_room_total_yen = v_room_total
    where id = v_reservation_room_id;
    v_total := v_total + v_room_total;
  end loop;

  update public.reservations set total_amount_yen = v_total where id = v_reservation_id;
  insert into public.payments(reservation_id, method, status, amount_yen)
  values (v_reservation_id, 'pay_at_hotel', 'pending', v_total);
  return v_reservation_id;
end;
$$;
