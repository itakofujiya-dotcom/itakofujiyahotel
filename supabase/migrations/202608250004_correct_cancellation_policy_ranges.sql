-- Correct the cancellation fee ranges without changing the online cancellation
-- deadline. Customers may still cancel online only through 8 days before arrival.

update public.cancellation_policies as policy
set min_days_before = 4,
    max_days_before = 7,
    description_ja = '宿泊日の7日前～4日前：宿泊料金の30％',
    description_en = '7 to 4 days before check-in: 30% cancellation fee.',
    description_ko = '체크인 7~4일 전: 숙박요금의 30%',
    updated_at = now()
where policy.code = 'days_6_to_4';

update public.cancellation_policies as policy
set min_days_before = 2,
    max_days_before = 3,
    description_ja = '宿泊日の3日前～2日前：宿泊料金の50％',
    description_en = '3 to 2 days before check-in: 50% cancellation fee.',
    description_ko = '체크인 3~2일 전: 숙박요금의 50%',
    updated_at = now()
where policy.code = 'days_3_to_2';

update public.cancellation_policies as policy
set description_ja = '無断不泊（No-show）：宿泊料金の100％',
    description_en = 'No-show: 100% cancellation fee.',
    description_ko = '노쇼(No-show): 숙박요금의 100%',
    updated_at = now()
where policy.code = 'no_show';

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

  select * into v_quote
  from public.calculate_reservation_cancellation(
    v_reservation.check_in,
    coalesce(v_reservation.total_amount_yen, 0)
  );

  v_online_cancellable :=
    v_reservation.status in ('pending', 'confirmed')
    and v_quote.days_before >= v_online_cancel_min_days
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
      when v_quote.days_before < v_online_cancel_min_days then 'CONTACT_HOTEL'
      when v_quote.fee_percent <> 0 then 'CONTACT_HOTEL'
      else null
    end,
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
