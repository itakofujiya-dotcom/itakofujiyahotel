begin;

-- Run as one migration transaction; freeze writers before taking the baseline.
lock table public.reservations, public.reservation_rooms, public.room_type_inventory,
  public.rooms, public.room_types, public.inventory_blocks in share row exclusive mode;

-- All inventory-affecting writes share a transaction mutex. Updating a real
-- row also forces stale REPEATABLE READ transactions to abort (40001).
-- Hotel-scale conservative serialization; never expose this internal table.
create table public.booking_inventory_mutex (
  id boolean primary key default true check (id),
  version bigint not null default 0
);
insert into public.booking_inventory_mutex default values;
revoke all on public.booking_inventory_mutex from public, anon, authenticated;
alter table public.booking_inventory_mutex enable row level security;

create table public.booking_inventory_balance (
  room_type_id uuid not null references public.room_types(id) on delete cascade,
  stay_date date not null,
  booked integer not null check (booked >= 0),
  remaining integer not null check (remaining >= 0),
  primary key (room_type_id, stay_date)
);
revoke all on public.booking_inventory_balance from public, anon, authenticated;
alter table public.booking_inventory_balance enable row level security;

create function public.lock_booking_inventory() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.booking_inventory_mutex set version = version + 1 where id;
  return null;
end;
$$;
revoke all on function public.lock_booking_inventory() from public;

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
      and not exists (
        select 1 from public.inventory_blocks b
        where b.room_id = room.id and b.reservation_room_id is null
          and b.status in ('held', 'active')
          and b.check_in <= p_stay_date and p_stay_date < b.check_out
          and (b.expires_at is null or b.expires_at > now())
      )
      and exists (select 1 from public.room_types rt
                  where rt.id = p_room_type_id and rt.is_sellable)
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


-- Reconcile only persisted balances and occupied nights. Configured quantities
-- remain sales ceilings, never counters. Cancellation releases booked units;
-- reducing a ceiling below existing bookings closes sales without cancelling them.
create function public.sync_booking_inventory() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v record;
  v_old integer;
  v_delta integer;
begin
  for v in
    select keys.room_type_id, keys.stay_date, a.*
    from (
      select b.room_type_id, b.stay_date from public.booking_inventory_balance b
      union
      select rr.room_type_id, d.day::date
      from public.reservation_rooms rr
      join public.reservations r on r.id = rr.reservation_id
      cross join lateral generate_series(r.check_in, r.check_out - 1, interval '1 day') d(day)
      where r.status in ('pending', 'confirmed', 'checked_in')
    ) keys
    cross join lateral public.calculate_room_type_availability(keys.room_type_id, keys.stay_date) a
    order by keys.room_type_id, keys.stay_date
  loop
    insert into public.booking_inventory_balance(room_type_id, stay_date, booked, remaining)
    values (v.room_type_id, v.stay_date, 0, v.base_sellable_quantity)
    on conflict do nothing;
    select booked into strict v_old from public.booking_inventory_balance
    where room_type_id = v.room_type_id and stay_date = v.stay_date for update;
    v_delta := v.booked_quantity - v_old;
    update public.booking_inventory_balance
    set remaining = greatest(v.base_sellable_quantity - v_old, 0)
    where room_type_id = v.room_type_id and stay_date = v.stay_date;
    if v_delta > 0 then
      update public.booking_inventory_balance
      set remaining = remaining - v_delta, booked = v.booked_quantity
      where room_type_id = v.room_type_id and stay_date = v.stay_date
        and remaining >= v_delta;
      if not found then
        raise exception 'INSUFFICIENT_INVENTORY' using errcode = 'P0001';
      end if;
    else
      update public.booking_inventory_balance
      set booked = v.booked_quantity, remaining = v.available_quantity
      where room_type_id = v.room_type_id and stay_date = v.stay_date;
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function public.sync_booking_inventory() from public;

-- Baseline existing reservations, including any pre-existing overbookings.
-- Do not silently delete or cancel historical customer reservations.
insert into public.booking_inventory_balance(room_type_id, stay_date, booked, remaining)
select k.room_type_id, k.stay_date, a.booked_quantity, a.available_quantity
from (
  select distinct rr.room_type_id, d.day::date as stay_date
  from public.reservation_rooms rr join public.reservations r on r.id = rr.reservation_id
  cross join lateral generate_series(r.check_in, r.check_out - 1, interval '1 day') d(day)
  where r.status in ('pending', 'confirmed', 'checked_in')
) k
cross join lateral public.calculate_room_type_availability(k.room_type_id, k.stay_date) a;

do $$
declare t text;
begin
  foreach t in array array['reservations', 'reservation_rooms', 'room_type_inventory',
                           'rooms', 'room_types', 'inventory_blocks'] loop
    execute format('create trigger booking_inventory_lock before insert or update or delete on public.%I for each statement execute function public.lock_booking_inventory()', t);
    execute format('create trigger booking_inventory_sync after insert or update or delete on public.%I for each statement execute function public.sync_booking_inventory()', t);
  end loop;
end;
$$;

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
      and rt.code in ('japanese', 'western');

    if found and not v_room_type.is_sellable then
      return jsonb_build_object('ok', false, 'code', 'BOOKING_NO_LONGER_AVAILABLE');
    end if;

    if v_room_type.id is null
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
    for v_stay_date in
      select day::date
      from generate_series(p_check_in, p_check_out - 1, interval '1 day') as day
    loop
      select a.available_quantity into v_available
      from public.calculate_room_type_availability(v_required.room_type_id, v_stay_date) a;

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

  update public.booking_inventory_mutex set version = version + 1 where id;

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
exception when raise_exception then
  if sqlerrm = 'INSUFFICIENT_INVENTORY' then
    return jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_INVENTORY');
  end if;
  return jsonb_build_object('ok', false, 'code', 'BOOKING_FAILED');
when others then
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


-- Preserve the legacy RPC's existing validation and pricing while exposing the
-- same stock error from the database guard (its exception block rolls back).
do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.create_public_reservation(uuid,date,date,integer,integer,integer,integer,uuid,text,text,text,text,time without time zone,text,integer)'::regprocedure)
  into v_definition;
  v_definition := replace(v_definition,
    E'exception\n  when others then',
    E'exception\n  when raise_exception then\n    if sqlerrm = ''INSUFFICIENT_INVENTORY'' then\n      return jsonb_build_object(''ok'', false, ''code'', ''INSUFFICIENT_INVENTORY'');\n    end if;\n    return jsonb_build_object(''ok'', false, ''code'', ''BOOKING_FAILED'');\n  when others then');
  if position($old$    select greatest(
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
$old$ in v_definition) = 0 then
    raise exception 'LEGACY_INVENTORY_DEFINITION_MISMATCH';
  end if;
  v_definition := replace(v_definition, $old$    select greatest(
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
$old$,
    $new$    select a.available_quantity into v_available
    from public.calculate_room_type_availability(p_room_type_id, v_stay_date) a;
$new$);
  v_definition := replace(v_definition, $old$  select count(*)::integer into v_active_rooms
  from public.rooms
  where room_type_id = p_room_type_id and sales_status = 'active';
$old$,
    '  update public.booking_inventory_mutex set version = version + 1 where id;');
  execute v_definition;
end;
$$;

commit;
