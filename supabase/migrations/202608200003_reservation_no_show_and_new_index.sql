create index reservations_unseen_online_idx
on public.reservations(created_at desc)
where booking_source = 'online' and admin_seen_at is null;

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

  if p_status = 'no_show' then
    update public.reservations
    set status = 'no_show', cancelled_at = now(), cancellation_fee_rate = 100,
        cancellation_fee_yen = coalesce(total_amount_yen, 0)
    where id = p_reservation_id;
    update public.inventory_blocks set status = 'released'
    where reservation_room_id in (
      select id from public.reservation_rooms where reservation_id = p_reservation_id
    ) and status in ('held', 'active');
  else
    update public.reservations set status = p_status where id = p_reservation_id;
  end if;
end;
$$;

revoke all on function public.change_reservation_status(uuid, text) from public;
grant execute on function public.change_reservation_status(uuid, text) to authenticated;
