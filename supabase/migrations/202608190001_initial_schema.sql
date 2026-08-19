-- Initial operational schema for 潮来富士屋ホテル.
-- Checkout dates are exclusive throughout the system: [check_in, check_out).
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create function public.set_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create table public.hotel_settings (
  id uuid primary key default gen_random_uuid(),
  hotel_name_ja text not null, hotel_name_en text not null, postal_code text not null,
  address_ja text not null, telephone text not null, fax text, email text,
  check_in_time time not null, check_out_time time not null,
  front_desk_open time not null, front_desk_close time not null,
  map_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.room_types (
  id uuid primary key default gen_random_uuid(), code text unique not null, name_ja text not null,
  description_ja text, standard_capacity smallint not null check (standard_capacity > 0),
  max_capacity smallint not null check (max_capacity >= standard_capacity),
  area_square_meters numeric(6,2), bed_description_ja text, is_sellable boolean not null default false,
  display_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(), room_number text unique not null, floor smallint not null,
  room_style text not null check (room_style in ('western','japanese')),
  room_type_id uuid references public.room_types(id) on delete set null,
  standard_capacity smallint not null check (standard_capacity > 0),
  max_capacity smallint not null check (max_capacity >= standard_capacity),
  sales_status text not null default 'active' check (sales_status in ('active','inactive','admin_only','maintenance')),
  operations_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.amenities (
  id uuid primary key default gen_random_uuid(), code text unique not null, label_ja text not null,
  category text not null check (category in ('facility','toiletry')), provided_by_default boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.room_amenities (room_id uuid references public.rooms(id) on delete cascade, amenity_id uuid references public.amenities(id) on delete cascade, primary key (room_id, amenity_id));
create table public.room_type_amenities (room_type_id uuid references public.room_types(id) on delete cascade, amenity_id uuid references public.amenities(id) on delete cascade, primary key (room_type_id, amenity_id));

create table public.room_rates (
  id uuid primary key default gen_random_uuid(), room_type_id uuid not null references public.room_types(id) on delete cascade,
  guest_count smallint not null check (guest_count between 1 and 20), valid_from date not null, valid_to date not null,
  price_yen integer not null check (price_yen >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (valid_to >= valid_from), unique (room_type_id, guest_count, valid_from, valid_to)
);
create table public.rate_overrides (
  id uuid primary key default gen_random_uuid(), room_type_id uuid not null references public.room_types(id) on delete cascade,
  stay_date date not null, guest_count smallint not null check (guest_count between 1 and 20),
  price_yen integer not null check (price_yen >= 0), reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (room_type_id, stay_date, guest_count)
);

create table public.guests (
  id uuid primary key default gen_random_uuid(), name text not null, name_kana text, email text, telephone text not null,
  postal_code text, address text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reservations (
  id uuid primary key default gen_random_uuid(), reservation_number text unique not null,
  primary_guest_id uuid not null references public.guests(id) on delete restrict,
  check_in date not null, check_out date not null, adults smallint not null check (adults > 0), children smallint not null default 0 check (children >= 0),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','checked_in','checked_out','no_show')),
  guest_note text, admin_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (check_out > check_in)
);
create table public.reservation_rooms (
  id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.reservations(id) on delete cascade,
  room_type_id uuid not null references public.room_types(id) on delete restrict, room_id uuid references public.rooms(id) on delete restrict,
  guest_count smallint not null check (guest_count > 0), quoted_price_yen integer check (quoted_price_yen >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.reservations(id) on delete restrict,
  method text not null check (method in ('pay_at_hotel','bank_transfer','card')),
  status text not null default 'pending' check (status in ('pending','awaiting_payment','paid','refunded','cancelled')),
  amount_yen integer not null check (amount_yen >= 0), paid_at timestamptz, external_reference text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- One row represents a room hold, manual closure, or confirmed allocation.
-- The exclusion constraint is the database-level double-booking guard.
create table public.inventory_blocks (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
  reservation_room_id uuid references public.reservation_rooms(id) on delete cascade,
  check_in date not null, check_out date not null,
  status text not null default 'active' check (status in ('held','active','released')),
  reason text, expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (check_out > check_in),
  exclude using gist (room_id with =, daterange(check_in, check_out, '[)') with &&) where (status in ('held','active'))
);

create table public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade, display_name text not null,
  role text not null default 'staff' check (role in ('staff','manager','owner')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

do $$ declare table_name text; begin foreach table_name in array array['hotel_settings','room_types','rooms','amenities','room_rates','rate_overrides','guests','reservations','reservation_rooms','payments','inventory_blocks','admin_profiles'] loop execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name); end loop; end $$;

alter table public.hotel_settings enable row level security; alter table public.room_types enable row level security;
alter table public.rooms enable row level security; alter table public.amenities enable row level security;
alter table public.room_amenities enable row level security; alter table public.room_type_amenities enable row level security;
alter table public.room_rates enable row level security; alter table public.rate_overrides enable row level security;
alter table public.guests enable row level security; alter table public.reservations enable row level security;
alter table public.reservation_rooms enable row level security; alter table public.payments enable row level security;
alter table public.inventory_blocks enable row level security; alter table public.admin_profiles enable row level security;

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_profiles where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public; grant execute on function public.is_admin() to authenticated;

create policy "public read hotel settings" on public.hotel_settings for select to anon, authenticated using (true);
create policy "public read sellable room types" on public.room_types for select to anon, authenticated using (is_sellable);
create policy "public read default amenities" on public.amenities for select to anon, authenticated using (provided_by_default);
-- No anonymous INSERT/UPDATE policies are created. Guest booking creation must use a validated
-- server-side function/Edge Function that atomically writes reservation + inventory block + payment.
do $$ declare table_name text; begin foreach table_name in array array['hotel_settings','room_types','rooms','amenities','room_amenities','room_type_amenities','room_rates','rate_overrides','guests','reservations','reservation_rooms','payments','inventory_blocks'] loop execute format('create policy "admin all %s" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', table_name, table_name); end loop; end $$;
create policy "admin read own profile" on public.admin_profiles for select to authenticated using (user_id = auth.uid());
