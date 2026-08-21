-- Enable safe Admin editing while keeping private settings (notably email)
-- out of anonymous table reads.

alter table public.hotel_settings
  add constraint hotel_settings_email_format_check
  check (
    email is null
    or btrim(email) = ''
    or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

drop policy if exists "public read hotel settings"
on public.hotel_settings;

revoke select on public.hotel_settings from anon;

create or replace function public.get_public_hotel_information()
returns table (
  hotel_name_ja text,
  hotel_name_en text,
  postal_code text,
  address_ja text,
  telephone text,
  fax text,
  map_url text,
  check_in_time time,
  check_out_time time,
  front_desk_open time,
  front_desk_close time
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    settings.hotel_name_ja,
    settings.hotel_name_en,
    settings.postal_code,
    settings.address_ja,
    settings.telephone,
    settings.fax,
    settings.map_url,
    settings.check_in_time,
    settings.check_out_time,
    settings.front_desk_open,
    settings.front_desk_close
  from public.hotel_settings as settings
  order by settings.created_at
  limit 1;
$$;

revoke all on function public.get_public_hotel_information() from public;
grant execute on function public.get_public_hotel_information()
to anon, authenticated;

comment on function public.get_public_hotel_information() is
  'Returns only hotel settings approved for public display. Email is intentionally excluded.';
