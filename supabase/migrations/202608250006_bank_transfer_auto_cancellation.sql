-- Automatically cancel unpaid bank-transfer reservations seven days after the
-- reservation was created. Delivery remains in the existing cancellation
-- notification outbox so email failures cannot roll back a cancellation.

alter table public.payments
  add column payment_due_at timestamptz;

comment on column public.payments.payment_due_at is
  'Bank-transfer payment deadline: the reservation creation instant plus seven days.';

update public.payments as payment
set payment_due_at = reservation.created_at + interval '7 days'
from public.reservations as reservation
where reservation.id = payment.reservation_id
  and payment.method = 'bank_transfer'
  and payment.payment_due_at is null;

create or replace function public.set_bank_transfer_payment_due_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation_created_at timestamptz;
begin
  if new.method <> 'bank_transfer' then
    new.payment_due_at := null;
    return new;
  end if;

  select reservation.created_at into strict v_reservation_created_at
  from public.reservations as reservation
  where reservation.id = new.reservation_id;

  new.payment_due_at := v_reservation_created_at + interval '7 days';
  return new;
end;
$$;

revoke all on function public.set_bank_transfer_payment_due_at() from public;

create trigger set_bank_transfer_payment_due_at
before insert or update of method, reservation_id, payment_due_at on public.payments
for each row execute function public.set_bank_transfer_payment_due_at();

alter table public.payments
  add constraint payments_bank_transfer_due_at_check
  check (
    (method = 'bank_transfer' and payment_due_at is not null)
    or (method <> 'bank_transfer' and payment_due_at is null)
  );

create index payments_expired_bank_transfer_idx
on public.payments(payment_due_at, reservation_id)
where method = 'bank_transfer'
  and status in ('pending', 'awaiting_payment');

create or replace function public.process_expired_bank_transfer_reservations(
  p_now timestamptz default now(),
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate record;
  v_reservation public.reservations%rowtype;
  v_payment public.payments%rowtype;
  v_quote record;
  v_processed integer := 0;
  v_released_blocks integer := 0;
  v_notifications integer := 0;
  v_row_count integer := 0;
  v_days integer;
  v_reason constant text := '入金期限切れによる自動キャンセル';
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  if p_now is null then
    raise exception 'NOW_REQUIRED' using errcode = '22023';
  end if;

  for v_candidate in
    select reservation.id as reservation_id, payment.id as payment_id
    from public.reservations as reservation
    join lateral (
      select candidate_payment.id,
             candidate_payment.method,
             candidate_payment.status,
             candidate_payment.payment_due_at
      from public.payments as candidate_payment
      where candidate_payment.reservation_id = reservation.id
      order by candidate_payment.created_at desc, candidate_payment.id desc
      limit 1
    ) as payment on true
    where reservation.status in ('pending', 'confirmed')
      and payment.method = 'bank_transfer'
      and payment.status in ('pending', 'awaiting_payment')
      and payment.payment_due_at <= p_now
    order by payment.payment_due_at, reservation.id
    for update of reservation skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  loop
    -- The admin payment-confirmation RPC locks the same payment row. Rechecking
    -- after this lock protects a payment confirmed concurrently with the job.
    select payment.* into v_payment
    from public.payments as payment
    where payment.id = v_candidate.payment_id
    for update;

    select reservation.* into v_reservation
    from public.reservations as reservation
    where reservation.id = v_candidate.reservation_id
    for update;

    if v_reservation.status not in ('pending', 'confirmed')
      or v_payment.method <> 'bank_transfer'
      or v_payment.status not in ('pending', 'awaiting_payment')
      or v_payment.paid_at is not null
      or v_payment.payment_due_at is null
      or v_payment.payment_due_at > p_now
    then
      continue;
    end if;

    v_days := v_reservation.check_in
      - (p_now at time zone 'Asia/Tokyo')::date;
    select round(policy.fee_percent)::integer as fee_percent,
           round(
             coalesce(v_reservation.total_amount_yen, 0)
             * policy.fee_percent / 100.0
           )::integer as fee_yen
    into strict v_quote
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

    update public.reservations as reservation
    set status = 'cancelled',
        cancelled_at = p_now,
        cancellation_fee_rate = v_quote.fee_percent,
        cancellation_fee_yen = v_quote.fee_yen,
        admin_note = case
          when position(v_reason in coalesce(reservation.admin_note, '')) > 0
            then reservation.admin_note
          when nullif(btrim(reservation.admin_note), '') is null
            then v_reason
          else reservation.admin_note || E'\n' || v_reason
        end
    where reservation.id = v_reservation.id
      and reservation.status in ('pending', 'confirmed');

    if not found then
      continue;
    end if;

    update public.payments as payment
    set status = 'cancelled'
    where payment.id = v_payment.id
      and payment.status in ('pending', 'awaiting_payment')
      and payment.paid_at is null;

    update public.inventory_blocks as block
    set status = 'released'
    where block.reservation_room_id in (
      select room.id
      from public.reservation_rooms as room
      where room.reservation_id = v_reservation.id
    )
      and block.status in ('held', 'active');
    get diagnostics v_row_count = row_count;
    v_released_blocks := v_released_blocks + v_row_count;

    insert into public.notification_deliveries(
      reservation_id, notification_type, recipient_kind
    ) values
      (v_reservation.id, 'reservation_cancelled', 'customer'),
      (v_reservation.id, 'reservation_cancelled', 'hotel')
    on conflict (reservation_id, notification_type, recipient_kind) do nothing;
    get diagnostics v_row_count = row_count;
    v_notifications := v_notifications + v_row_count;

    v_processed := v_processed + 1;
  end loop;

  return jsonb_build_object(
    'processed', v_processed,
    'releasedInventoryBlocks', v_released_blocks,
    'notificationsEnqueued', v_notifications,
    'processedAt', p_now
  );
end;
$$;

revoke all on function public.process_expired_bank_transfer_reservations(
  timestamptz, integer
) from public;
grant execute on function public.process_expired_bank_transfer_reservations(
  timestamptz, integer
) to service_role;

-- Include the reason in the existing cancellation email snapshot without
-- exposing the full private admin note to the customer.
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
    'cancellationReason', case
      when position('入金期限切れによる自動キャンセル' in coalesce(reservation.admin_note, '')) > 0
        then 'bank_transfer_payment_expired'
      else null
    end,
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

revoke all on function public.get_cancellation_notification_snapshot(uuid)
  from public;
grant execute on function public.get_cancellation_notification_snapshot(uuid)
  to service_role;

-- Supabase Cron calls the existing cancellation-email worker hourly. The job
-- is inert until both named Vault secrets are configured in the target project:
--   bank_transfer_expiration_worker_url =
--     https://<project-ref>.supabase.co/functions/v1/send-cancellation-email
--   notification_worker_secret = the existing Edge Function worker secret
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'hourly-bank-transfer-expiration';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'hourly-bank-transfer-expiration',
    '5 * * * *',
    $cron$
      select net.http_post(
        url := worker_url.decrypted_secret,
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-notification-worker-secret', worker_secret.decrypted_secret
        ),
        body := '{}'::jsonb
      )
      from vault.decrypted_secrets as worker_url
      cross join vault.decrypted_secrets as worker_secret
      where worker_url.name = 'bank_transfer_expiration_worker_url'
        and worker_secret.name = 'notification_worker_secret';
    $cron$
  );
end;
$$;
