-- The hourly bank-transfer worker must not drain unrelated public/admin
-- cancellation notifications that happen to remain pending.

create or replace function public.claim_pending_auto_cancellation_notifications(
  p_limit integer default 50
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
    join public.reservations as reservation
      on reservation.id = delivery.reservation_id
    where delivery.status = 'pending'
      and delivery.notification_type = 'reservation_cancelled'
      and position(
        '入金期限切れによる自動キャンセル'
        in coalesce(reservation.admin_note, '')
      ) > 0
    order by delivery.created_at, delivery.id
    for update of delivery skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
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

revoke all on function public.claim_pending_auto_cancellation_notifications(
  integer
) from public;
grant execute on function public.claim_pending_auto_cancellation_notifications(
  integer
) to service_role;
