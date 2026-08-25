-- Complete the reservation-created email snapshot with operational times and
-- the full public hotel contact. The original migration is intentionally left
-- unchanged because it may already be applied remotely.

create or replace function public.get_notification_reservation_snapshot(
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
    'expectedCheckInTime',
      to_char(reservation.expected_check_in_time, 'HH24:MI'),
    'stayNights', reservation.check_out - reservation.check_in,
    'roomCount', coalesce(rooms.room_count, 0),
    'totalAmountYen', reservation.total_amount_yen,
    'guestNote', reservation.guest_note,
    'createdAt', reservation.created_at,
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
    'cancellationPolicies', coalesce(policies.items, '[]'::jsonb),
    'hotel', jsonb_build_object(
      'nameJa', hotel.hotel_name_ja,
      'nameKo', hotel.hotel_name_ko,
      'nameEn', hotel.hotel_name_en,
      'email', hotel.email,
      'telephone', hotel.telephone,
      'fax', hotel.fax,
      'checkInTime', to_char(hotel.check_in_time, 'HH24:MI'),
      'checkOutTime', to_char(hotel.check_out_time, 'HH24:MI'),
      'bankTransferInstructionsJa', hotel.bank_transfer_instructions_ja,
      'bankTransferInstructionsKo', hotel.bank_transfer_instructions_ko
    )
  ) into v_snapshot
  from public.notification_deliveries as delivery
  join public.reservations as reservation
    on reservation.id = delivery.reservation_id
  join public.guests as guest on guest.id = reservation.primary_guest_id
  left join lateral (
    select p.method, p.status, p.amount_yen
    from public.payments as p
    where p.reservation_id = reservation.id
    order by p.created_at desc, p.id desc
    limit 1
  ) as payment on true
  left join lateral (
    select
      count(*)::integer as room_count,
      jsonb_agg(jsonb_build_object(
        'roomTypeCode', room_type.code,
        'roomTypeNameJa', room_type.name_ja,
        'roomTypeNameKo', room_type.name_ko,
        'adults', room.adult_guest_count,
        'paidChildren', room.paid_child_count,
        'freePreschoolChildren', room.free_preschool_count,
        'mealPlan', room.meal_plan,
        'baseRoomAmountYen',
          coalesce(room.quoted_room_total_yen, 0) - room.meal_surcharge_yen,
        'mealSurchargeYen', room.meal_surcharge_yen,
        'subtotalYen', room.quoted_room_total_yen
      ) order by room.created_at, room.id) as items
    from public.reservation_rooms as room
    join public.room_types as room_type on room_type.id = room.room_type_id
    where room.reservation_id = reservation.id
  ) as rooms on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'code', policy.code,
      'minDaysBefore', policy.min_days_before,
      'maxDaysBefore', policy.max_days_before,
      'feePercent', policy.fee_percent,
      'isNoShow', policy.is_no_show,
      'descriptionJa', policy.description_ja,
      'descriptionKo', policy.description_ko
    ) order by policy.display_order, policy.id) as items
    from public.cancellation_policies as policy
    where policy.is_active = true
  ) as policies on true
  cross join lateral (
    select settings.*
    from public.hotel_settings as settings
    order by settings.created_at
    limit 1
  ) as hotel
  where delivery.id = p_delivery_id
    and delivery.status = 'sending';

  return v_snapshot;
end;
$$;

revoke all on function public.get_notification_reservation_snapshot(uuid)
  from public;
grant execute on function public.get_notification_reservation_snapshot(uuid)
  to service_role;
