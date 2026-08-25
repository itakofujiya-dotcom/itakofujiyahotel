-- Complete public reservation lookup/cancellation and enqueue idempotent
-- cancellation notifications. Existing migrations remain immutable.

-- Current operating policy: free until 8 days before arrival, 30% exactly
-- 4 days before, and 50% exactly 2 days before. Stable codes are retained.
update public.cancellation_policies as policy
set min_days_before = 8,
    max_days_before = null,
    description_ja = '宿泊日の8日前まで：キャンセル料無料',
    description_en = 'Free cancellation until 8 days before check-in.',
    description_ko = '체크인 8일 전까지 무료 취소',
    updated_at = now()
where policy.code = 'free_7_plus';

update public.cancellation_policies as policy
set min_days_before = 4,
    max_days_before = 4,
    description_ja = '宿泊日の4日前：宿泊料金の30％',
    description_en = '4 days before check-in: 30% cancellation fee.',
    description_ko = '체크인 4일 전: 숙박요금의 30%',
    updated_at = now()
where policy.code = 'days_6_to_4';

update public.cancellation_policies as policy
set min_days_before = 2,
    max_days_before = 2,
    description_ja = '宿泊日の2日前：宿泊料金の50％',
    description_en = '2 days before check-in: 50% cancellation fee.',
    description_ko = '체크인 2일 전: 숙박요금의 50%',
    updated_at = now()
where policy.code = 'days_3_to_2';

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
  v_online_cancel_min_days constant integer := 8;
  v_online_cancellable boolean := false;
  v_days integer;
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
  order by payment.created_at desc, payment.id desc
  limit 1;

  v_days := v_reservation.check_in - (now() at time zone 'Asia/Tokyo')::date;

  -- Some dates intentionally have no fixed fee in the approved policy. Keep
  -- lookup available on those dates without inventing a fee.
  select
    null::uuid as policy_id,
    null::text as policy_code,
    null::text as policy_description_ja,
    v_days as days_before,
    null::integer as fee_percent,
    null::integer as fee_yen
  into v_quote;

  if v_days >= v_online_cancel_min_days
    or v_days in (4, 2, 1, 0)
    or v_days < 0
  then
    select * into v_quote
    from public.calculate_reservation_cancellation(
      v_reservation.check_in,
      coalesce(v_reservation.total_amount_yen, 0)
    );
  end if;

  v_online_cancellable :=
    v_reservation.status in ('pending', 'confirmed')
    and v_days >= v_online_cancel_min_days
    and v_quote.fee_percent = 0;

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
    'guestKana', v_guest.name_kana_or_roman,
    'guestNote', v_reservation.guest_note,
    'checkIn', to_char(v_reservation.check_in, 'YYYY-MM-DD'),
    'checkOut', to_char(v_reservation.check_out, 'YYYY-MM-DD'),
    'stayNights', v_reservation.check_out - v_reservation.check_in,
    'roomCount', jsonb_array_length(v_rooms),
    'rooms', v_rooms,
    'totalAmountYen', coalesce(v_reservation.total_amount_yen, 0),
    'paymentMethod', v_payment.method,
    'paymentStatus', v_payment.status,
    'reservationStatus', v_reservation.status,
    'cancellable', v_online_cancellable,
    'onlineCancellationDeadlineDays', v_online_cancel_min_days,
    'onlineCancellationReason', case
      when v_reservation.status = 'cancelled' then 'ALREADY_CANCELLED'
      when v_reservation.status not in ('pending', 'confirmed') then 'STATUS_NOT_CANCELLABLE'
      when v_days < v_online_cancel_min_days then 'CONTACT_HOTEL'
      when v_quote.policy_id is null or v_quote.fee_percent <> 0 then 'CONTACT_HOTEL'
      else null
    end,
    'policyCode', v_quote.policy_code,
    'policyDescriptionJa', v_quote.policy_description_ja,
    'daysBefore', v_days,
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
  v_cancelled_at timestamptz := now();
  v_online_cancel_min_days constant integer := 8;
  v_days integer;
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

  v_days := v_reservation.check_in - (now() at time zone 'Asia/Tokyo')::date;
  if v_days < v_online_cancel_min_days then
    return jsonb_build_object(
      'ok', false,
      'code', 'ONLINE_CANCELLATION_WINDOW_CLOSED'
    );
  end if;

  select * into v_quote
  from public.calculate_reservation_cancellation(
    v_reservation.check_in,
    coalesce(v_reservation.total_amount_yen, 0)
  );

  if v_quote.fee_percent <> 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'ONLINE_CANCELLATION_WINDOW_CLOSED'
    );
  end if;

  select payment.* into v_payment
  from public.payments as payment
  where payment.reservation_id = v_reservation.id
  order by payment.created_at desc, payment.id desc
  limit 1;

  update public.reservations as reservation
  set status = 'cancelled',
      cancelled_at = v_cancelled_at,
      cancellation_fee_rate = v_quote.fee_percent,
      cancellation_fee_yen = v_quote.fee_yen
  where reservation.id = v_reservation.id;

  -- Unpaid payment intents are closed. Paid payments deliberately remain paid
  -- so the Admin refund-required warning and manual refund workflow are kept.
  update public.payments as payment
  set status = 'cancelled'
  where payment.reservation_id = v_reservation.id
    and payment.status in ('pending', 'awaiting_payment');

  update public.inventory_blocks as block
  set status = 'released'
  where block.reservation_room_id in (
    select room.id
    from public.reservation_rooms as room
    where room.reservation_id = v_reservation.id
  )
    and block.status in ('held', 'active');
  get diagnostics v_released_blocks = row_count;

  insert into public.notification_deliveries(
    reservation_id, notification_type, recipient_kind
  ) values
    (v_reservation.id, 'reservation_cancelled', 'customer'),
    (v_reservation.id, 'reservation_cancelled', 'hotel')
  on conflict (reservation_id, notification_type, recipient_kind) do nothing;

  return jsonb_build_object(
    'ok', true,
    'code', 'RESERVATION_CANCELLED',
    'reservationNumber', v_reservation.reservation_number,
    'cancelledAt', v_cancelled_at,
    'checkIn', to_char(v_reservation.check_in, 'YYYY-MM-DD'),
    'checkOut', to_char(v_reservation.check_out, 'YYYY-MM-DD'),
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

create or replace function public.claim_public_cancellation_notifications(
  p_reservation_number text,
  p_contact text
)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contact text := btrim(coalesce(p_contact, ''));
  v_contact_phone text := regexp_replace(coalesce(p_contact, ''), '[^0-9]', '', 'g');
begin
  if length(btrim(coalesce(p_reservation_number, ''))) < 3
    or length(v_contact) < 3
  then
    return;
  end if;

  return query
  with candidates as (
    select delivery.id
    from public.notification_deliveries as delivery
    join public.reservations as reservation
      on reservation.id = delivery.reservation_id
    join public.guests as guest on guest.id = reservation.primary_guest_id
    where upper(reservation.reservation_number) = upper(btrim(p_reservation_number))
      and reservation.status = 'cancelled'
      and delivery.notification_type = 'reservation_cancelled'
      and delivery.status = 'pending'
      and (
        lower(btrim(guest.email)) = lower(v_contact)
        or (
          length(v_contact_phone) >= 6
          and regexp_replace(guest.telephone, '[^0-9]', '', 'g') = v_contact_phone
        )
      )
    order by delivery.created_at, delivery.id
    for update of delivery skip locked
  )
  update public.notification_deliveries as delivery
  set status = 'sending',
      attempt_count = delivery.attempt_count + 1,
      claimed_at = now(),
      last_error_code = null,
      last_error_message = null
  from candidates
  where delivery.id = candidates.id
  returning delivery.*;
end;
$$;

create or replace function public.claim_pending_cancellation_notifications(
  p_limit integer default 10
)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidates as (
    select delivery.id
    from public.notification_deliveries as delivery
    where delivery.status = 'pending'
      and delivery.notification_type = 'reservation_cancelled'
    order by delivery.created_at, delivery.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update public.notification_deliveries as delivery
  set status = 'sending',
      attempt_count = delivery.attempt_count + 1,
      claimed_at = now(),
      last_error_code = null,
      last_error_message = null
  from candidates
  where delivery.id = candidates.id
  returning delivery.*;
end;
$$;

create or replace function public.get_cancellation_notification_snapshot(
  p_delivery_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_snapshot jsonb;
begin
  select jsonb_build_object(
    'deliveryId', delivery.id,
    'recipientKind', delivery.recipient_kind,
    'notificationType', delivery.notification_type,
    'reservationId', reservation.id,
    'reservationNumber', reservation.reservation_number,
    'locale', reservation.booking_locale,
    'checkIn', to_char(reservation.check_in, 'YYYY-MM-DD'),
    'checkOut', to_char(reservation.check_out, 'YYYY-MM-DD'),
    'stayNights', reservation.check_out - reservation.check_in,
    'roomCount', coalesce(rooms.room_count, 0),
    'totalAmountYen', coalesce(reservation.total_amount_yen, 0),
    'guestNote', reservation.guest_note,
    'cancelledAt', reservation.cancelled_at,
    'cancellationFeePercent', coalesce(reservation.cancellation_fee_rate, 0),
    'cancellationFeeYen', coalesce(reservation.cancellation_fee_yen, 0),
    'refundTargetYen', case
      when payment.status = 'paid'
      then greatest(payment.amount_yen - coalesce(reservation.cancellation_fee_yen, 0), 0)
      else 0
    end,
    'guest', jsonb_build_object(
      'name', guest.name,
      'kana', guest.name_kana_or_roman,
      'email', guest.email,
      'telephone', guest.telephone
    ),
    'payment', jsonb_build_object(
      'method', payment.method,
      'status', payment.status,
      'amountYen', payment.amount_yen
    ),
    'rooms', coalesce(rooms.items, '[]'::jsonb),
    'hotel', jsonb_build_object(
      'nameJa', hotel.hotel_name_ja,
      'nameKo', hotel.hotel_name_ko,
      'email', hotel.email,
      'telephone', hotel.telephone,
      'fax', hotel.fax
    )
  ) into v_snapshot
  from public.notification_deliveries as delivery
  join public.reservations as reservation on reservation.id = delivery.reservation_id
  join public.guests as guest on guest.id = reservation.primary_guest_id
  left join lateral (
    select p.method, p.status, p.amount_yen
    from public.payments as p
    where p.reservation_id = reservation.id
    order by p.created_at desc, p.id desc
    limit 1
  ) as payment on true
  left join lateral (
    select count(*)::integer as room_count,
      jsonb_agg(jsonb_build_object(
        'roomTypeNameJa', room_type.name_ja,
        'roomTypeNameKo', room_type.name_ko,
        'adults', room.adult_guest_count,
        'paidChildren', room.paid_child_count,
        'freePreschoolChildren', room.free_preschool_count,
        'mealPlan', room.meal_plan
      ) order by room.created_at, room.id) as items
    from public.reservation_rooms as room
    join public.room_types as room_type on room_type.id = room.room_type_id
    where room.reservation_id = reservation.id
  ) as rooms on true
  cross join lateral (
    select settings.*
    from public.hotel_settings as settings
    order by settings.created_at
    limit 1
  ) as hotel
  where delivery.id = p_delivery_id
    and delivery.notification_type = 'reservation_cancelled'
    and delivery.status = 'sending';

  return v_snapshot;
end;
$$;

revoke all on function public.lookup_public_reservation(text, text) from public;
grant execute on function public.lookup_public_reservation(text, text)
  to anon, authenticated;
revoke all on function public.cancel_public_reservation(text, text) from public;
grant execute on function public.cancel_public_reservation(text, text)
  to anon, authenticated;

revoke all on function public.claim_public_cancellation_notifications(text, text)
  from public;
revoke all on function public.claim_pending_cancellation_notifications(integer)
  from public;
revoke all on function public.get_cancellation_notification_snapshot(uuid)
  from public;
grant execute on function public.claim_public_cancellation_notifications(text, text)
  to service_role;
grant execute on function public.claim_pending_cancellation_notifications(integer)
  to service_role;
grant execute on function public.get_cancellation_notification_snapshot(uuid)
  to service_role;
