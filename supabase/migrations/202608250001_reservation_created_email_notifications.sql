-- Reservation-created email outbox and locale snapshot.
-- Email delivery is intentionally outside the booking transaction: a provider
-- failure must never roll back a confirmed reservation.

alter table public.reservations
  add column booking_locale text not null default 'ja'
  check (booking_locale in ('ja', 'ko'));

comment on column public.reservations.booking_locale is
  'Customer-facing language captured when an online reservation is created.';

alter table public.hotel_settings
  add column bank_transfer_instructions_ja text,
  add column bank_transfer_instructions_ko text;

comment on column public.hotel_settings.bank_transfer_instructions_ja is
  'Private Japanese bank-transfer instructions used by server-side notifications.';
comment on column public.hotel_settings.bank_transfer_instructions_ko is
  'Private Korean bank-transfer instructions used by server-side notifications.';

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  notification_type text not null check (length(trim(notification_type)) > 0),
  recipient_kind text not null check (recipient_kind in ('customer', 'hotel')),
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider text,
  provider_message_id text,
  last_error_code text,
  last_error_message text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reservation_id, notification_type, recipient_kind)
);

create index notification_deliveries_pending_idx
on public.notification_deliveries(created_at)
where status = 'pending';

create trigger set_notification_deliveries_updated_at
before update on public.notification_deliveries
for each row execute function public.set_updated_at();

alter table public.notification_deliveries enable row level security;
revoke all on table public.notification_deliveries from anon, authenticated;

create or replace function public.enqueue_reservation_created_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.booking_source = 'online' then
    insert into public.notification_deliveries(
      reservation_id, notification_type, recipient_kind
    ) values
      (new.id, 'reservation_created', 'customer'),
      (new.id, 'reservation_created', 'hotel')
    on conflict (reservation_id, notification_type, recipient_kind) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.enqueue_reservation_created_notifications() from public;

create trigger enqueue_reservation_created_notifications
after insert on public.reservations
for each row execute function public.enqueue_reservation_created_notifications();

create or replace function public.claim_pending_notification_deliveries(
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
      and delivery.notification_type = 'reservation_created'
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

create or replace function public.claim_reservation_notification_deliveries(
  p_reservation_id uuid,
  p_booking_request_id uuid
)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.reservations as reservation
    where reservation.id = p_reservation_id
      and reservation.booking_request_id = p_booking_request_id
      and reservation.booking_source = 'online'
  ) then
    return;
  end if;

  return query
  update public.notification_deliveries as delivery
  set status = 'sending',
      attempt_count = delivery.attempt_count + 1,
      claimed_at = now(),
      last_error_code = null,
      last_error_message = null
  where delivery.reservation_id = p_reservation_id
    and delivery.notification_type = 'reservation_created'
    and delivery.status = 'pending'
  returning delivery.*;
end;
$$;

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
      'bankTransferInstructionsJa', hotel.bank_transfer_instructions_ja,
      'bankTransferInstructionsKo', hotel.bank_transfer_instructions_ko
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
        'baseRoomAmountYen', coalesce(room.quoted_room_total_yen, 0) - room.meal_surcharge_yen,
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

create or replace function public.mark_notification_delivery_sent(
  p_delivery_id uuid,
  p_provider text,
  p_provider_message_id text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.notification_deliveries as delivery
  set status = 'sent',
      provider = nullif(trim(p_provider), ''),
      provider_message_id = nullif(trim(p_provider_message_id), ''),
      sent_at = now(),
      last_error_code = null,
      last_error_message = null
  where delivery.id = p_delivery_id and delivery.status = 'sending';
$$;

create or replace function public.mark_notification_delivery_failed(
  p_delivery_id uuid,
  p_error_code text,
  p_error_message text,
  p_skipped boolean default false
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.notification_deliveries as delivery
  set status = case when p_skipped then 'skipped' else 'failed' end,
      last_error_code = left(coalesce(p_error_code, 'UNKNOWN'), 100),
      last_error_message = left(coalesce(p_error_message, 'Notification delivery failed.'), 500)
  where delivery.id = p_delivery_id and delivery.status = 'sending';
$$;

revoke all on function public.claim_pending_notification_deliveries(integer) from public;
revoke all on function public.claim_reservation_notification_deliveries(uuid, uuid) from public;
revoke all on function public.get_notification_reservation_snapshot(uuid) from public;
revoke all on function public.mark_notification_delivery_sent(uuid, text, text) from public;
revoke all on function public.mark_notification_delivery_failed(uuid, text, text, boolean) from public;
grant execute on function public.claim_pending_notification_deliveries(integer) to service_role;
grant execute on function public.claim_reservation_notification_deliveries(uuid, uuid) to service_role;
grant execute on function public.get_notification_reservation_snapshot(uuid) to service_role;
grant execute on function public.mark_notification_delivery_sent(uuid, text, text) to service_role;
grant execute on function public.mark_notification_delivery_failed(uuid, text, text, boolean) to service_role;

-- Locale-aware overload. The original signature remains executable during a
-- coordinated application rollout; old clients safely use the default 'ja'.
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
  p_expected_total_yen integer,
  p_locale text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if p_locale not in ('ja', 'ko') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_BOOKING');
  end if;

  v_result := public.create_public_mixed_reservation(
    p_booking_request_id, p_check_in, p_check_out, p_rooms,
    p_name, p_name_kana_or_roman, p_telephone, p_email,
    p_expected_check_in_time, p_guest_note, p_expected_total_yen
  );

  if coalesce((v_result->>'ok')::boolean, false) then
    update public.reservations as reservation
    set booking_locale = p_locale
    where reservation.id = (v_result->>'reservationId')::uuid
      and reservation.booking_request_id = p_booking_request_id;
  end if;

  return v_result;
end;
$$;

revoke all on function public.create_public_mixed_reservation(
  uuid, date, date, jsonb, text, text, text, text, time, text, integer, text
) from public;
grant execute on function public.create_public_mixed_reservation(
  uuid, date, date, jsonb, text, text, text, text, time, text, integer, text
) to anon, authenticated;
