create or replace function public.change_reservation_status(
  p_reservation_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_blocking_payment_status text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select r.status into strict v_current
  from public.reservations as r
  where r.id = p_reservation_id
  for update;

  if not (
    (v_current = 'pending' and p_status in ('confirmed', 'cancelled')) or
    (v_current = 'confirmed' and p_status in ('checked_in', 'cancelled', 'no_show')) or
    (v_current = 'checked_in' and p_status = 'checked_out') or
    v_current = p_status
  ) then
    raise exception 'INVALID_STATUS_TRANSITION' using errcode = '22023';
  end if;

  if v_current = 'confirmed' and p_status = 'checked_in' then
    perform 1
    from public.payments as p
    where p.reservation_id = p_reservation_id
    order by p.id
    for update;

    select p.status into v_blocking_payment_status
    from public.payments as p
    where p.reservation_id = p_reservation_id
      and p.status in ('refunded', 'cancelled')
    order by p.id
    limit 1;

    if v_blocking_payment_status is not null then
      raise exception 'PAYMENT_STATUS_BLOCKS_CHECK_IN' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.reservation_rooms as rr
      where rr.reservation_id = p_reservation_id
    ) or exists (
      select 1
      from public.reservation_rooms as rr
      where rr.reservation_id = p_reservation_id
        and rr.room_id is null
    ) then
      raise exception 'ROOM_ASSIGNMENT_REQUIRED' using errcode = '22023';
    end if;
  end if;

  if p_status = 'no_show' then
    update public.reservations as r
    set status = 'no_show',
        cancelled_at = now(),
        cancellation_fee_rate = 100,
        cancellation_fee_yen = coalesce(r.total_amount_yen, 0)
    where r.id = p_reservation_id;

    update public.inventory_blocks as ib
    set status = 'released'
    where ib.reservation_room_id in (
      select rr.id
      from public.reservation_rooms as rr
      where rr.reservation_id = p_reservation_id
    )
      and ib.status in ('held', 'active');
  else
    update public.reservations as r
    set status = p_status
    where r.id = p_reservation_id;
  end if;
end;
$$;

revoke all on function public.change_reservation_status(uuid, text)
from public;

grant execute on function public.change_reservation_status(uuid, text)
to authenticated;
