-- Public reservation lookup/cancellation and a single source of truth for
-- cancellation fees. Actual payment refunds remain an administrator task.

create or replace function public.calculate_reservation_cancellation(
  p_check_in date,
  p_total_amount_yen integer
)
returns table (
  policy_id uuid,
  policy_code text,
  policy_description_ja text,
  days_before integer,
  fee_percent integer,
  fee_yen integer
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_days integer := p_check_in - (now() at time zone 'Asia/Tokyo')::date;
  v_policy public.cancellation_policies%rowtype;
begin
  if p_check_in is null or p_total_amount_yen is null or p_total_amount_yen < 0 then
    raise exception 'INVALID_CANCELLATION_INPUT' using errcode = '22023';
  end if;

  select policy.* into v_policy
  from public.cancellation_policies as policy
  where policy.is_active = true
    and policy.is_no_show = false
    and (
      (
        v_days < 0
        and policy.min_days_before = 0
        and policy.max_days_before = 0
      )
      or (
        v_days >= 0
        and (policy.min_days_before is null or v_days >= policy.min_days_before)
        and (policy.max_days_before is null or v_days <= policy.max_days_before)
      )
    )
  order by policy.display_order, policy.id
  limit 1;

  if not found then
    raise exception 'CANCELLATION_POLICY_NOT_FOUND' using errcode = 'P0001';
  end if;

  return query select
    v_policy.id,
    v_policy.code,
    v_policy.description_ja,
    v_days,
    round(v_policy.fee_percent)::integer,
    round(p_total_amount_yen * v_policy.fee_percent / 100.0)::integer;
end;
$$;

revoke all on function public.calculate_reservation_cancellation(date, integer)
from public;

create or replace function public.get_admin_reservation_cancellation_quote(
  p_reservation_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.reservations%rowtype;
  v_quote record;
  v_payment public.payments%rowtype;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select reservation.* into strict v_reservation
  from public.reservations as reservation
  where reservation.id = p_reservation_id;

  select * into v_quote
  from public.calculate_reservation_cancellation(
    v_reservation.check_in,
    coalesce(v_reservation.total_amount_yen, 0)
  );

  select payment.* into v_payment
  from public.payments as payment
  where payment.reservation_id = v_reservation.id
  order by payment.created_at, payment.id
  limit 1;

  return jsonb_build_object(
    'policyCode', v_quote.policy_code,
    'policyDescriptionJa', v_quote.policy_description_ja,
    'daysBefore', v_quote.days_before,
    'feePercent', v_quote.fee_percent,
    'feeYen', v_quote.fee_yen,
    'refundTargetYen', case
      when v_payment.status = 'paid'
      then greatest(v_payment.amount_yen - v_quote.fee_yen, 0)
      else 0
    end
  );
end;
$$;

revoke all on function public.get_admin_reservation_cancellation_quote(uuid)
from public;
grant execute on function public.get_admin_reservation_cancellation_quote(uuid)
to authenticated;

create or replace function public.lookup_public_reservation(
  p_reservation_number text,
  p_contact text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.reservations%rowtype;
  v_guest public.guests%rowtype;
  v_payment public.payments%rowtype;
  v_quote record;
  v_rooms jsonb;
  v_contact text := btrim(coalesce(p_contact, ''));
  v_contact_phone text := regexp_replace(coalesce(p_contact, ''), '[^0-9]', '', 'g');
  v_contact_matches boolean := false;
begin
  if length(btrim(coalesce(p_reservation_number, ''))) < 3
    or length(v_contact) < 3
  then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND');
  end if;

  select reservation.* into v_reservation
  from public.reservations as reservation
  where upper(reservation.reservation_number) = upper(btrim(p_reservation_number))
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND');
  end if;

  select guest.* into strict v_guest
  from public.guests as guest
  where guest.id = v_reservation.primary_guest_id;

  v_contact_matches :=
    lower(btrim(v_guest.email)) = lower(v_contact)
    or (
      length(v_contact_phone) >= 6
      and regexp_replace(v_guest.telephone, '[^0-9]', '', 'g') = v_contact_phone
    );
  if not v_contact_matches then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND');
  end if;

  select payment.* into v_payment
  from public.payments as payment
  where payment.reservation_id = v_reservation.id
  order by payment.created_at, payment.id
  limit 1;

  select * into v_quote
  from public.calculate_reservation_cancellation(
    v_reservation.check_in,
    coalesce(v_reservation.total_amount_yen, 0)
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'roomIndex', room.ordinality - 1,
    'roomTypeNameJa', room_type.name_ja,
    'adultGuestCount', room.adult_guest_count,
    'paidChildCount', room.paid_child_count,
    'freePreschoolCount', room.free_preschool_count,
    'mealPlan', room.meal_plan
  ) order by room.ordinality), '[]'::jsonb)
  into v_rooms
  from (
    select reserved_room.*,
      row_number() over (
        order by reserved_room.created_at, reserved_room.id
      )::integer as ordinality
    from public.reservation_rooms as reserved_room
    where reserved_room.reservation_id = v_reservation.id
  ) as room
  join public.room_types as room_type on room_type.id = room.room_type_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'RESERVATION_FOUND',
    'reservationNumber', v_reservation.reservation_number,
    'guestName', v_guest.name,
    'checkIn', to_char(v_reservation.check_in, 'YYYY-MM-DD'),
    'checkOut', to_char(v_reservation.check_out, 'YYYY-MM-DD'),
    'rooms', v_rooms,
    'totalAmountYen', coalesce(v_reservation.total_amount_yen, 0),
    'paymentMethod', v_payment.method,
    'paymentStatus', v_payment.status,
    'reservationStatus', v_reservation.status,
    'cancellable', v_reservation.status in ('pending', 'confirmed'),
    'policyCode', v_quote.policy_code,
    'policyDescriptionJa', v_quote.policy_description_ja,
    'daysBefore', v_quote.days_before,
    'feePercent', case
      when v_reservation.status = 'cancelled'
      then coalesce(v_reservation.cancellation_fee_rate, v_quote.fee_percent)
      else v_quote.fee_percent
    end,
    'feeYen', case
      when v_reservation.status = 'cancelled'
      then coalesce(v_reservation.cancellation_fee_yen, v_quote.fee_yen)
      else v_quote.fee_yen
    end,
    'refundTargetYen', case
      when v_payment.status = 'paid'
      then greatest(
        v_payment.amount_yen - case
          when v_reservation.status = 'cancelled'
          then coalesce(v_reservation.cancellation_fee_yen, v_quote.fee_yen)
          else v_quote.fee_yen
        end,
        0
      )
      else 0
    end,
    'cancelledAt', v_reservation.cancelled_at,
    'recordedCancellationFeePercent', v_reservation.cancellation_fee_rate,
    'recordedCancellationFeeYen', v_reservation.cancellation_fee_yen
  );
exception when others then
  raise warning 'lookup_public_reservation failed: % (%)', sqlerrm, sqlstate;
  return jsonb_build_object('ok', false, 'code', 'RESERVATION_LOOKUP_FAILED');
end;
$$;

revoke all on function public.lookup_public_reservation(text, text) from public;
grant execute on function public.lookup_public_reservation(text, text)
to anon, authenticated;

create or replace function public.cancel_public_reservation(
  p_reservation_number text,
  p_contact text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.reservations%rowtype;
  v_guest public.guests%rowtype;
  v_payment public.payments%rowtype;
  v_quote record;
  v_contact text := btrim(coalesce(p_contact, ''));
  v_contact_phone text := regexp_replace(coalesce(p_contact, ''), '[^0-9]', '', 'g');
  v_contact_matches boolean := false;
  v_released_blocks integer := 0;
begin
  if length(btrim(coalesce(p_reservation_number, ''))) < 3
    or length(v_contact) < 3
  then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND');
  end if;

  select reservation.* into v_reservation
  from public.reservations as reservation
  where upper(reservation.reservation_number) = upper(btrim(p_reservation_number))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND');
  end if;

  select guest.* into strict v_guest
  from public.guests as guest
  where guest.id = v_reservation.primary_guest_id;
  v_contact_matches :=
    lower(btrim(v_guest.email)) = lower(v_contact)
    or (
      length(v_contact_phone) >= 6
      and regexp_replace(v_guest.telephone, '[^0-9]', '', 'g') = v_contact_phone
    );
  if not v_contact_matches then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND');
  end if;

  if v_reservation.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_CANCELLED');
  end if;
  if v_reservation.status not in ('pending', 'confirmed') then
    return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_CANCELLABLE');
  end if;

  select * into v_quote
  from public.calculate_reservation_cancellation(
    v_reservation.check_in,
    coalesce(v_reservation.total_amount_yen, 0)
  );

  select payment.* into v_payment
  from public.payments as payment
  where payment.reservation_id = v_reservation.id
  order by payment.created_at, payment.id
  limit 1;

  update public.reservations as reservation
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_fee_rate = v_quote.fee_percent,
      cancellation_fee_yen = v_quote.fee_yen
  where reservation.id = v_reservation.id;

  update public.inventory_blocks as block
  set status = 'released'
  where block.reservation_room_id in (
    select room.id
    from public.reservation_rooms as room
    where room.reservation_id = v_reservation.id
  )
    and block.status in ('held', 'active');
  get diagnostics v_released_blocks = row_count;

  return jsonb_build_object(
    'ok', true,
    'code', 'RESERVATION_CANCELLED',
    'reservationNumber', v_reservation.reservation_number,
    'feePercent', v_quote.fee_percent,
    'feeYen', v_quote.fee_yen,
    'refundTargetYen', case
      when v_payment.status = 'paid'
      then greatest(v_payment.amount_yen - v_quote.fee_yen, 0)
      else 0
    end,
    'releasedInventoryBlocks', v_released_blocks,
    'automaticRefundProcessed', false
  );
exception when others then
  raise warning 'cancel_public_reservation failed: % (%)', sqlerrm, sqlstate;
  return jsonb_build_object('ok', false, 'code', 'RESERVATION_CANCELLATION_FAILED');
end;
$$;

revoke all on function public.cancel_public_reservation(text, text) from public;
grant execute on function public.cancel_public_reservation(text, text)
to anon, authenticated;

-- Admin cancellation now uses the same active policy table as public cancellation.
create or replace function public.cancel_admin_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.reservations%rowtype;
  v_quote record;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select reservation.* into strict v_reservation
  from public.reservations as reservation
  where reservation.id = p_reservation_id
  for update;

  if v_reservation.status not in ('pending', 'confirmed') then
    raise exception 'RESERVATION_NOT_CANCELLABLE' using errcode = '22023';
  end if;

  select * into v_quote
  from public.calculate_reservation_cancellation(
    v_reservation.check_in,
    coalesce(v_reservation.total_amount_yen, 0)
  );

  update public.reservations as reservation
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_fee_rate = v_quote.fee_percent,
      cancellation_fee_yen = v_quote.fee_yen
  where reservation.id = p_reservation_id;

  update public.inventory_blocks as block
  set status = 'released'
  where block.reservation_room_id in (
    select room.id
    from public.reservation_rooms as room
    where room.reservation_id = p_reservation_id
  )
    and block.status in ('held', 'active');
end;
$$;

-- General status transitions can no longer bypass the cancellation workflow.
create or replace function public.change_reservation_status(
  p_reservation_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current text;
  v_blocking_payment_status text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if p_status = 'cancelled' then
    raise exception 'USE_RESERVATION_CANCELLATION_RPC' using errcode = '22023';
  end if;

  select reservation.status into strict v_current
  from public.reservations as reservation
  where reservation.id = p_reservation_id
  for update;

  if not (
    (v_current = 'pending' and p_status = 'confirmed')
    or (v_current = 'confirmed' and p_status in ('checked_in', 'no_show'))
    or (v_current = 'checked_in' and p_status = 'checked_out')
    or v_current = p_status
  ) then
    raise exception 'INVALID_STATUS_TRANSITION' using errcode = '22023';
  end if;

  if v_current = 'confirmed' and p_status = 'checked_in' then
    perform 1
    from public.payments as payment
    where payment.reservation_id = p_reservation_id
    order by payment.id
    for update;

    select payment.status into v_blocking_payment_status
    from public.payments as payment
    where payment.reservation_id = p_reservation_id
      and payment.status in ('refunded', 'cancelled')
    order by payment.id
    limit 1;

    if v_blocking_payment_status is not null then
      raise exception 'PAYMENT_STATUS_BLOCKS_CHECK_IN' using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.reservation_rooms as room
      where room.reservation_id = p_reservation_id
    ) or exists (
      select 1 from public.reservation_rooms as room
      where room.reservation_id = p_reservation_id and room.room_id is null
    ) then
      raise exception 'ROOM_ASSIGNMENT_REQUIRED' using errcode = '22023';
    end if;
  end if;

  if p_status = 'no_show' then
    update public.reservations as reservation
    set status = 'no_show',
        cancelled_at = now(),
        cancellation_fee_rate = 100,
        cancellation_fee_yen = coalesce(reservation.total_amount_yen, 0)
    where reservation.id = p_reservation_id;

    update public.inventory_blocks as block
    set status = 'released'
    where block.reservation_room_id in (
      select room.id from public.reservation_rooms as room
      where room.reservation_id = p_reservation_id
    ) and block.status in ('held', 'active');
  else
    update public.reservations as reservation
    set status = p_status
    where reservation.id = p_reservation_id;
  end if;
end;
$$;

revoke all on function public.cancel_admin_reservation(uuid) from public;
grant execute on function public.cancel_admin_reservation(uuid) to authenticated;
revoke all on function public.change_reservation_status(uuid, text) from public;
grant execute on function public.change_reservation_status(uuid, text)
to authenticated;
