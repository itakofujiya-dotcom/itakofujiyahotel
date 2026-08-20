-- Administrator reservation workflow: immutable nightly price snapshots,
-- concurrency-safe reservation numbers, and atomic room/status operations.

alter table public.reservations
  add column admin_seen_at timestamptz,
  add column cancelled_at timestamptz,
  add column cancellation_fee_rate integer
    check (cancellation_fee_rate is null or cancellation_fee_rate between 0 and 100),
  add column cancellation_fee_yen integer
    check (cancellation_fee_yen is null or cancellation_fee_yen >= 0);

create table public.reservation_room_nights (
  id uuid primary key default gen_random_uuid(),
  reservation_room_id uuid not null
    references public.reservation_rooms(id)
    on delete cascade,
  stay_date date not null,
  price_per_person_yen integer not null
    check (price_per_person_yen >= 0),
  paid_guest_count smallint not null
    check (paid_guest_count between 1 and 4),
  room_total_yen integer not null
    check (room_total_yen >= 0),
  created_at timestamptz not null default now(),
  unique (reservation_room_id, stay_date)
);

create index reservation_room_nights_stay_date_idx
on public.reservation_room_nights(stay_date);

alter table public.reservation_room_nights enable row level security;

create policy "admin manage reservation room nights"
on public.reservation_room_nights
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete
on public.reservation_room_nights
to authenticated;

create table public.reservation_number_counters (
  counter_date date primary key,
  last_value integer not null check (last_value > 0)
);

alter table public.reservation_number_counters enable row level security;
revoke all on public.reservation_number_counters from anon, authenticated;

create or replace function public.next_admin_reservation_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := (now() at time zone 'Asia/Tokyo')::date;
  v_value integer;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  insert into public.reservation_number_counters(counter_date, last_value)
  values (v_date, 1)
  on conflict (counter_date)
  do update set last_value = public.reservation_number_counters.last_value + 1
  returning last_value into v_value;

  return 'IFH-' || to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_value::text, 3, '0');
end;
$$;

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
  v_paid_guest_count integer;
  v_free_count integer;
  v_base_price integer;
  v_price integer;
  v_first_price integer;
  v_room_total integer;
  v_total integer := 0;
  v_total_paid_guests integer := 0;
  v_total_free_guests integer := 0;
  v_adjustment_type text;
  v_adjustment_value integer;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if v_check_out <= v_check_in or v_check_out > v_check_in + 10 then
    raise exception 'INVALID_STAY_DATES' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rooms) < 1 or jsonb_array_length(p_rooms) > 4 then
    raise exception 'INVALID_ROOM_COUNT' using errcode = '22023';
  end if;
  if p_reservation->>'booking_source' not in ('phone', 'walk_in', 'admin') then
    raise exception 'INVALID_BOOKING_SOURCE' using errcode = '22023';
  end if;

  for v_room in select value from jsonb_array_elements(p_rooms)
  loop
    v_paid_guest_count := (v_room->>'paid_guest_count')::integer;
    v_free_count := coalesce((v_room->>'free_preschool_count')::integer, 0);
    if v_paid_guest_count not between 1 and 4 or v_free_count < 0 then
      raise exception 'INVALID_GUEST_COUNT' using errcode = '22023';
    end if;
    v_total_paid_guests := v_total_paid_guests + v_paid_guest_count;
    v_total_free_guests := v_total_free_guests + v_free_count;
  end loop;

  insert into public.guests (
    name, name_kana_or_roman, email, telephone, nationality, postal_code, address
  ) values (
    trim(p_guest->>'name'), nullif(trim(p_guest->>'name_kana_or_roman'), ''),
    trim(p_guest->>'email'), trim(p_guest->>'telephone'),
    nullif(trim(p_guest->>'nationality'), ''), nullif(trim(p_guest->>'postal_code'), ''),
    nullif(trim(p_guest->>'address'), '')
  ) returning id into v_guest_id;

  insert into public.reservations (
    reservation_number, primary_guest_id, check_in, check_out,
    adults, paid_children, free_preschool_children, status, booking_source,
    expected_check_in_time, guest_note, admin_note, total_amount_yen
  ) values (
    public.next_admin_reservation_number(), v_guest_id, v_check_in, v_check_out,
    v_total_paid_guests, 0, v_total_free_guests, 'confirmed',
    p_reservation->>'booking_source',
    nullif(p_reservation->>'expected_check_in_time', '')::time,
    nullif(trim(p_reservation->>'guest_note'), ''),
    nullif(trim(p_reservation->>'admin_note'), ''), 0
  ) returning id into v_reservation_id;

  for v_room in select value from jsonb_array_elements(p_rooms)
  loop
    v_paid_guest_count := (v_room->>'paid_guest_count')::integer;
    v_free_count := coalesce((v_room->>'free_preschool_count')::integer, 0);
    v_room_total := 0;
    v_first_price := null;

    insert into public.reservation_rooms (
      reservation_id, room_type_id, paid_guest_count, free_preschool_count
    ) values (
      v_reservation_id, (v_room->>'room_type_id')::uuid,
      v_paid_guest_count, v_free_count
    ) returning id into v_reservation_room_id;

    for v_stay_date in
      select day::date
      from generate_series(v_check_in, v_check_out - 1, interval '1 day') day
    loop
      select rr.price_per_person_yen
      into v_base_price
      from public.room_rates rr
      where rr.room_type_id = (v_room->>'room_type_id')::uuid
        and rr.guest_count = v_paid_guest_count
        and v_stay_date between rr.valid_from and rr.valid_to
      order by rr.valid_from desc
      limit 1;
      if v_base_price is null then
        raise exception 'ROOM_RATE_NOT_FOUND:%', v_stay_date using errcode = 'P0001';
      end if;

      select ro.price_per_person_yen
      into v_price
      from public.rate_overrides ro
      where ro.room_type_id = (v_room->>'room_type_id')::uuid
        and ro.guest_count = v_paid_guest_count
        and ro.stay_date = v_stay_date
      limit 1;

      if not found then
        v_price := v_base_price;
        select rr.adjustment_type, rr.adjustment_value
        into v_adjustment_type, v_adjustment_value
        from public.rate_rule_dates rrd
        join public.rate_rules rr on rr.id = rrd.rate_rule_id
        where rrd.stay_date = v_stay_date and rr.is_active = true
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
      v_room_total := v_room_total + (v_price * v_paid_guest_count);
      insert into public.reservation_room_nights (
        reservation_room_id, stay_date, price_per_person_yen,
        paid_guest_count, room_total_yen
      ) values (
        v_reservation_room_id, v_stay_date, v_price,
        v_paid_guest_count, v_price * v_paid_guest_count
      );
    end loop;

    update public.reservation_rooms
    set quoted_price_per_person_yen = v_first_price,
        quoted_room_total_yen = v_room_total
    where id = v_reservation_room_id;
    v_total := v_total + v_room_total;
  end loop;

  update public.reservations set total_amount_yen = v_total
  where id = v_reservation_id;

  insert into public.payments(reservation_id, method, status, amount_yen)
  values (v_reservation_id, 'pay_at_hotel', 'pending', v_total);

  return v_reservation_id;
end;
$$;

create or replace function public.assign_reservation_room(
  p_reservation_room_id uuid,
  p_room_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation_room public.reservation_rooms%rowtype;
  v_reservation public.reservations%rowtype;
  v_room public.rooms%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  select * into strict v_reservation_room from public.reservation_rooms where id = p_reservation_room_id for update;
  select * into strict v_reservation from public.reservations where id = v_reservation_room.reservation_id;
  select * into strict v_room from public.rooms where id = p_room_id;
  if v_room.room_type_id <> v_reservation_room.room_type_id then raise exception 'ROOM_TYPE_MISMATCH' using errcode = '22023'; end if;
  if v_room.sales_status not in ('active', 'admin_only') then raise exception 'ROOM_NOT_ASSIGNABLE' using errcode = '22023'; end if;
  if v_reservation.status in ('cancelled', 'checked_out', 'no_show') then raise exception 'RESERVATION_NOT_ASSIGNABLE' using errcode = '22023'; end if;

  update public.inventory_blocks set status = 'released'
  where reservation_room_id = p_reservation_room_id and status in ('held', 'active');
  update public.reservation_rooms set room_id = p_room_id where id = p_reservation_room_id;
  insert into public.inventory_blocks (
    room_id, reservation_room_id, check_in, check_out, status, reason
  ) values (
    p_room_id, p_reservation_room_id, v_reservation.check_in,
    v_reservation.check_out, 'active', 'reservation assignment'
  );
end;
$$;

create or replace function public.change_reservation_status(
  p_reservation_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_current text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  select status into strict v_current from public.reservations where id = p_reservation_id for update;
  if not (
    (v_current = 'pending' and p_status in ('confirmed', 'cancelled')) or
    (v_current = 'confirmed' and p_status in ('checked_in', 'cancelled', 'no_show')) or
    (v_current = 'checked_in' and p_status = 'checked_out') or
    v_current = p_status
  ) then raise exception 'INVALID_STATUS_TRANSITION' using errcode = '22023'; end if;
  update public.reservations set status = p_status where id = p_reservation_id;
  if p_status = 'no_show' then
    update public.inventory_blocks set status = 'released'
    where reservation_room_id in (
      select id from public.reservation_rooms where reservation_id = p_reservation_id
    ) and status in ('held', 'active');
  end if;
end;
$$;

create or replace function public.cancel_admin_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations%rowtype;
  v_days integer;
  v_rate integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  select * into strict v_reservation from public.reservations where id = p_reservation_id for update;
  if v_reservation.status not in ('pending', 'confirmed') then raise exception 'RESERVATION_NOT_CANCELLABLE' using errcode = '22023'; end if;
  v_days := v_reservation.check_in - (now() at time zone 'Asia/Tokyo')::date;
  v_rate := case when v_days >= 7 then 0 when v_days >= 4 then 30 when v_days >= 2 then 50 else 100 end;
  update public.reservations
  set status = 'cancelled', cancelled_at = now(), cancellation_fee_rate = v_rate,
      cancellation_fee_yen = round(coalesce(total_amount_yen, 0) * v_rate / 100.0)
  where id = p_reservation_id;
  update public.inventory_blocks set status = 'released'
  where reservation_room_id in (
    select id from public.reservation_rooms where reservation_id = p_reservation_id
  ) and status in ('held', 'active');
end;
$$;

create or replace function public.update_admin_reservation_contact(
  p_reservation_id uuid,
  p_guest jsonb,
  p_reservation jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_guest_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  select primary_guest_id into strict v_guest_id from public.reservations where id = p_reservation_id for update;
  update public.guests set
    name = trim(p_guest->>'name'),
    name_kana_or_roman = nullif(trim(p_guest->>'name_kana_or_roman'), ''),
    telephone = trim(p_guest->>'telephone'),
    email = trim(p_guest->>'email')
  where id = v_guest_id;
  update public.reservations set
    expected_check_in_time = nullif(p_reservation->>'expected_check_in_time', '')::time,
    guest_note = nullif(trim(p_reservation->>'guest_note'), ''),
    admin_note = nullif(trim(p_reservation->>'admin_note'), '')
  where id = p_reservation_id;
end;
$$;

revoke all on function public.next_admin_reservation_number() from public;
revoke all on function public.create_admin_reservation(jsonb, jsonb, jsonb) from public;
revoke all on function public.assign_reservation_room(uuid, uuid) from public;
revoke all on function public.change_reservation_status(uuid, text) from public;
revoke all on function public.cancel_admin_reservation(uuid) from public;
revoke all on function public.update_admin_reservation_contact(uuid, jsonb, jsonb) from public;

grant execute on function public.next_admin_reservation_number() to authenticated;
grant execute on function public.create_admin_reservation(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.assign_reservation_room(uuid, uuid) to authenticated;
grant execute on function public.change_reservation_status(uuid, text) to authenticated;
grant execute on function public.cancel_admin_reservation(uuid) to authenticated;
grant execute on function public.update_admin_reservation_contact(uuid, jsonb, jsonb) to authenticated;
