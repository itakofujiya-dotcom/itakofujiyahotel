create or replace function public.update_admin_payment_status(
  p_payment_id uuid,
  p_expected_status text,
  p_status text
)
returns table (
  id uuid,
  status text,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_restore_status text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select * into strict v_payment
  from public.payments
  where payments.id = p_payment_id
  for update;

  if v_payment.status <> p_expected_status then
    raise exception 'PAYMENT_STATUS_CHANGED' using errcode = '40001';
  end if;

  v_restore_status := case
    when v_payment.method = 'bank_transfer' then 'awaiting_payment'
    else 'pending'
  end;

  if not (
    (v_payment.status in ('pending', 'awaiting_payment') and p_status = 'paid') or
    (v_payment.status = 'paid' and p_status in (v_restore_status, 'refunded'))
  ) then
    raise exception 'INVALID_PAYMENT_STATUS_TRANSITION' using errcode = '22023';
  end if;

  update public.payments
  set status = p_status,
      paid_at = case
        when p_status = 'paid' then now()
        when p_status in ('pending', 'awaiting_payment') then null
        else paid_at
      end
  where payments.id = p_payment_id;

  return query
  select payments.id, payments.status, payments.paid_at
  from public.payments
  where payments.id = p_payment_id;
end;
$$;

revoke all on function public.update_admin_payment_status(uuid, text, text)
from public;

grant execute on function public.update_admin_payment_status(uuid, text, text)
to authenticated;
