-- ============================================================
-- 潮来富士屋ホテル
-- Initial Operational Database Schema
--
-- Important:
-- Checkout dates are exclusive throughout the system.
-- A stay from 2026-08-20 to 2026-08-21 means:
-- [2026-08-20, 2026-08-21)
-- ============================================================


-- ============================================================
-- 0. Extensions
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;


-- ============================================================
-- 1. updated_at helper
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- 2. HOTEL SETTINGS
--
-- 호텔 기본정보 + 예약 운영 설정
-- 코드에 하드코딩하지 않고 관리할 값
-- ============================================================

create table public.hotel_settings (
  id uuid primary key default gen_random_uuid(),

  hotel_name_ja text not null,
  hotel_name_en text,
  hotel_name_ko text,

  postal_code text,
  address_ja text,
  address_en text,
  address_ko text,

  telephone text,
  fax text,
  email text,

  map_url text,

  check_in_time time not null default '16:00',
  check_out_time time not null default '10:00',

  front_desk_open time not null default '16:00',
  front_desk_close time not null default '22:00',

  -- 오늘부터 최대 40일 후까지 예약 가능
  max_booking_days integer not null default 40
    check (max_booking_days > 0),

  -- 최대 10박
  max_stay_nights integer not null default 10
    check (max_stay_nights > 0),

  -- 당일 예약 12:00 마감
  same_day_booking_cutoff time not null default '12:00',

  pets_allowed boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create trigger set_hotel_settings_updated_at
before update on public.hotel_settings
for each row
execute function public.set_updated_at();


-- ============================================================
-- 3. ROOM TYPES
--
-- 고객에게 판매되는 "상품"
--
-- 현재 상품:
--   - 和室
--   - 洋室
--
-- 실제 객실번호와 반드시 분리한다.
-- 1호 라인은 별도 상품으로 만들지 않는다.
-- ============================================================

create table public.room_types (
  id uuid primary key default gen_random_uuid(),

  code text unique not null,

  name_ja text not null,
  name_en text,
  name_ko text,

  description_ja text,
  description_en text,
  description_ko text,

  standard_capacity smallint not null default 2
    check (standard_capacity > 0),

  max_capacity smallint not null default 4
    check (max_capacity >= standard_capacity),

  area_square_meters numeric(6,2),

  bed_description_ja text,
  bed_description_en text,
  bed_description_ko text,

  is_sellable boolean not null default true,

  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create trigger set_room_types_updated_at
before update on public.room_types
for each row
execute function public.set_updated_at();


-- ============================================================
-- 4. PHYSICAL ROOMS
--
-- 실제 물리 객실
--
-- 고객은 和室 / 洋室만 예약하며,
-- 실제 객실번호는 호텔이 나중에 배정한다.
-- ============================================================

create table public.rooms (
  id uuid primary key default gen_random_uuid(),

  room_number text unique not null,

  floor smallint not null
    check (floor between 2 and 6),

  room_style text not null
    check (room_style in ('western', 'japanese')),

  room_type_id uuid not null
    references public.room_types(id)
    on update cascade
    on delete restrict,

  standard_capacity smallint not null default 2
    check (standard_capacity > 0),

  max_capacity smallint not null default 4
    check (max_capacity >= standard_capacity),

  sales_status text not null default 'active'
    check (
      sales_status in (
        'active',
        'inactive',
        'admin_only',
        'maintenance'
      )
    ),

  operations_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index rooms_room_type_id_idx
on public.rooms(room_type_id);

create index rooms_floor_idx
on public.rooms(floor);

create index rooms_sales_status_idx
on public.rooms(sales_status);


create trigger set_rooms_updated_at
before update on public.rooms
for each row
execute function public.set_updated_at();


-- ============================================================
-- 5. AMENITIES
-- ============================================================

create table public.amenities (
  id uuid primary key default gen_random_uuid(),

  code text unique not null,

  name_ja text not null,
  name_en text,
  name_ko text,

  category text not null
    check (
      category in (
        'facility',
        'amenity',
        'bathroom',
        'other'
      )
    ),

  provided_by_default boolean not null default true,

  icon_key text,

  display_order integer not null default 0,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create trigger set_amenities_updated_at
before update on public.amenities
for each row
execute function public.set_updated_at();


-- ============================================================
-- 6. ROOM ↔ AMENITY
--
-- 특정 객실만 다른 비품이 있을 경우 사용
-- ============================================================

create table public.room_amenities (
  room_id uuid not null
    references public.rooms(id)
    on delete cascade,

  amenity_id uuid not null
    references public.amenities(id)
    on delete cascade,

  primary key (room_id, amenity_id)
);


-- ============================================================
-- 7. ROOM TYPE ↔ AMENITY
--
-- 和室 / 洋室 공통 어메니티
-- ============================================================

create table public.room_type_amenities (
  room_type_id uuid not null
    references public.room_types(id)
    on delete cascade,

  amenity_id uuid not null
    references public.amenities(id)
    on delete cascade,

  primary key (room_type_id, amenity_id)
);


create index room_type_amenities_amenity_idx
on public.room_type_amenities(amenity_id);


-- ============================================================
-- 8. BASE ROOM RATES
--
-- 가격은 "객실당" 단순 정액이 아니라
-- 숙박 인원수에 따른 1인 가격
--
-- 예:
-- 和室
-- 1명 13,500
-- 2명 8,500/person
-- 3명 8,500/person
-- 4명 8,500/person
-- ============================================================

create table public.room_rates (
  id uuid primary key default gen_random_uuid(),

  room_type_id uuid not null
    references public.room_types(id)
    on delete cascade,

  guest_count smallint not null
    check (guest_count between 1 and 4),

  valid_from date not null,
  valid_to date not null,

  -- 1인당 가격
  price_per_person_yen integer not null
    check (price_per_person_yen >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (valid_to >= valid_from),

  unique (
    room_type_id,
    guest_count,
    valid_from,
    valid_to
  )
);


create index room_rates_room_type_idx
on public.room_rates(room_type_id);


create trigger set_room_rates_updated_at
before update on public.room_rates
for each row
execute function public.set_updated_at();


-- ============================================================
-- 9. DATE-SPECIFIC RATE OVERRIDES
--
-- 향후 관리자에서 특정 날짜 가격을 변경할 때 사용
--
-- 예:
-- 골든위크 / 연말 / 특정 행사일
-- ============================================================

create table public.rate_overrides (
  id uuid primary key default gen_random_uuid(),

  room_type_id uuid not null
    references public.room_types(id)
    on delete cascade,

  stay_date date not null,

  guest_count smallint not null
    check (guest_count between 1 and 4),

  price_per_person_yen integer not null
    check (price_per_person_yen >= 0),

  reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    room_type_id,
    stay_date,
    guest_count
  )
);


create index rate_overrides_date_idx
on public.rate_overrides(stay_date);


create trigger set_rate_overrides_updated_at
before update on public.rate_overrides
for each row
execute function public.set_updated_at();


-- ============================================================
-- 10. ONLINE SELLABLE INVENTORY
--
-- 중요:
--
-- 실제 호텔 객실 수와
-- 온라인 판매 가능 수량은 별개다.
--
-- 관리자가 날짜별 / 객실타입별로
-- 온라인 판매수량을 직접 설정한다.
--
-- 예:
-- 2026-08-25
-- 和室 → 10
-- 洋室 → 5
-- ============================================================

create table public.room_type_inventory (
  id uuid primary key default gen_random_uuid(),

  room_type_id uuid not null
    references public.room_types(id)
    on delete cascade,

  stay_date date not null,

  sellable_quantity integer not null
    check (sellable_quantity >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    room_type_id,
    stay_date
  )
);


create index room_type_inventory_date_idx
on public.room_type_inventory(stay_date);

create index room_type_inventory_room_type_idx
on public.room_type_inventory(room_type_id);


create trigger set_room_type_inventory_updated_at
before update on public.room_type_inventory
for each row
execute function public.set_updated_at();


-- ============================================================
-- 11. GUESTS
--
-- 대표 예약자 정보
-- ============================================================

create table public.guests (
  id uuid primary key default gen_random_uuid(),

  name text not null,

  -- 일본인: 후리가나
  -- 한국/해외 고객: 영문명 사용 가능
  name_kana_or_roman text,

  email text not null,

  telephone text not null,

  nationality text,

  postal_code text,
  address text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create trigger set_guests_updated_at
before update on public.guests
for each row
execute function public.set_updated_at();


-- ============================================================
-- 12. RESERVATIONS
--
-- 예약 단위
--
-- 초기 운영:
--   현장결제
--   예약 완료 즉시 확정
--
-- DB는 향후 다른 예약방식도 대응하도록 유지
-- ============================================================

create table public.reservations (
  id uuid primary key default gen_random_uuid(),

  reservation_number text unique not null,

  primary_guest_id uuid not null
    references public.guests(id)
    on delete restrict,

  check_in date not null,
  check_out date not null,

  -- 성인
  adults smallint not null
    check (adults > 0),

  -- 초등학생 이상 또는 유료 아동
  paid_children smallint not null default 0
    check (paid_children >= 0),

  -- 무료 미취학 아동
  -- 부모와 침구 공유
  -- 객실 정원에는 포함하지 않는다.
  free_preschool_children smallint not null default 0
    check (free_preschool_children >= 0),

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'confirmed',
        'cancelled',
        'checked_in',
        'checked_out',
        'no_show'
      )
    ),

  -- 온라인 / 전화 / 관리자 직접등록 등
  booking_source text not null default 'online'
    check (
      booking_source in (
        'online',
        'phone',
        'walk_in',
        'admin'
      )
    ),

  expected_check_in_time time,

  guest_note text,
  admin_note text,

  total_amount_yen integer
    check (
      total_amount_yen is null
      or total_amount_yen >= 0
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (check_out > check_in)
);


create index reservations_check_in_idx
on public.reservations(check_in);

create index reservations_check_out_idx
on public.reservations(check_out);

create index reservations_status_idx
on public.reservations(status);

create index reservations_created_at_idx
on public.reservations(created_at desc);


create trigger set_reservations_updated_at
before update on public.reservations
for each row
execute function public.set_updated_at();


-- ============================================================
-- 13. RESERVATION ROOMS
--
-- 한 예약에서 최대 4실 예약 가능
--
-- 고객은 Room Type만 선택하고
-- 실제 room_id는 호텔이 나중에 배정
--
-- 따라서 room_id는 nullable
-- ============================================================

create table public.reservation_rooms (
  id uuid primary key default gen_random_uuid(),

  reservation_id uuid not null
    references public.reservations(id)
    on delete cascade,

  room_type_id uuid not null
    references public.room_types(id)
    on delete restrict,

  -- 실제 객실 배정 전에는 null
  room_id uuid
    references public.rooms(id)
    on delete restrict,

  -- 가격을 지불하는 인원
  paid_guest_count smallint not null
    check (paid_guest_count between 1 and 4),

  -- 부모와 침구를 공유하는 무료 미취학 아동
  free_preschool_count smallint not null default 0
    check (free_preschool_count >= 0),

  -- 해당 방의 예약 시점 가격 snapshot
  quoted_price_per_person_yen integer
    check (
      quoted_price_per_person_yen is null
      or quoted_price_per_person_yen >= 0
    ),

  quoted_room_total_yen integer
    check (
      quoted_room_total_yen is null
      or quoted_room_total_yen >= 0
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index reservation_rooms_reservation_idx
on public.reservation_rooms(reservation_id);

create index reservation_rooms_room_type_idx
on public.reservation_rooms(room_type_id);

create index reservation_rooms_room_idx
on public.reservation_rooms(room_id);


create trigger set_reservation_rooms_updated_at
before update on public.reservation_rooms
for each row
execute function public.set_updated_at();


-- ============================================================
-- 14. PAYMENTS
--
-- 초기 UI에서는 pay_at_hotel만 사용한다.
--
-- bank_transfer / card는
-- 나중에 추가할 수 있도록 DB 구조만 유지.
-- ============================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),

  reservation_id uuid not null
    references public.reservations(id)
    on delete restrict,

  method text not null default 'pay_at_hotel'
    check (
      method in (
        'pay_at_hotel',
        'bank_transfer',
        'card'
      )
    ),

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'awaiting_payment',
        'paid',
        'refunded',
        'cancelled'
      )
    ),

  amount_yen integer not null
    check (amount_yen >= 0),

  paid_at timestamptz,

  external_reference text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index payments_reservation_idx
on public.payments(reservation_id);

create index payments_status_idx
on public.payments(status);


create trigger set_payments_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();


-- ============================================================
-- 15. PHYSICAL ROOM INVENTORY BLOCKS
--
-- 실제 객실번호 배정 후
-- 동일한 물리 객실이 같은 날짜에
-- 중복 배정되는 것을 DB 차원에서 방지한다.
--
-- 중요:
-- 온라인 판매수량 제어는
-- room_type_inventory에서 별도로 처리한다.
-- ============================================================

create table public.inventory_blocks (
  id uuid primary key default gen_random_uuid(),

  room_id uuid not null
    references public.rooms(id)
    on delete cascade,

  reservation_room_id uuid
    references public.reservation_rooms(id)
    on delete cascade,

  check_in date not null,
  check_out date not null,

  status text not null default 'active'
    check (
      status in (
        'held',
        'active',
        'released'
      )
    ),

  reason text,

  expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (check_out > check_in),

  exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (
    status in ('held', 'active')
  )
);


create index inventory_blocks_room_idx
on public.inventory_blocks(room_id);


create trigger set_inventory_blocks_updated_at
before update on public.inventory_blocks
for each row
execute function public.set_updated_at();


-- ============================================================
-- 16. CANCELLATION POLICIES
--
-- 현재 호텔 정책:
--
-- 8일 전까지       0%
-- 4일 전           30%
-- 2일 전           50%
-- 전날             100%
-- 당일             100%
-- No-show          100%
--
-- 고객 직접취소 가능 범위와
-- 실제 수수료 계산은 예약 API에서 별도 검증한다.
-- ============================================================

create table public.cancellation_policies (
  id uuid primary key default gen_random_uuid(),

  code text unique not null,

  min_days_before integer,
  max_days_before integer,

  fee_percent numeric(5,2) not null
    check (
      fee_percent >= 0
      and fee_percent <= 100
    ),

  is_no_show boolean not null default false,

  description_ja text,
  description_en text,
  description_ko text,

  display_order integer not null default 0,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    min_days_before is null
    or max_days_before is null
    or max_days_before >= min_days_before
  )
);


create trigger set_cancellation_policies_updated_at
before update on public.cancellation_policies
for each row
execute function public.set_updated_at();


-- ============================================================
-- 17. ADMIN PROFILES
--
-- Supabase Auth User와 연결
--
-- 현재 예상 관리자:
-- 사장님 / 이사님 / 프런트
-- ============================================================

create table public.admin_profiles (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  display_name text not null,

  role text not null default 'staff'
    check (
      role in (
        'staff',
        'manager',
        'owner'
      )
    ),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create trigger set_admin_profiles_updated_at
before update on public.admin_profiles
for each row
execute function public.set_updated_at();


-- ============================================================
-- 18. ADMIN CHECK FUNCTION
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and is_active = true
  );
$$;


revoke all
on function public.is_admin()
from public;

grant execute
on function public.is_admin()
to authenticated;


-- ============================================================
-- 19. ENABLE RLS
-- ============================================================

alter table public.hotel_settings enable row level security;
alter table public.room_types enable row level security;
alter table public.rooms enable row level security;
alter table public.amenities enable row level security;
alter table public.room_amenities enable row level security;
alter table public.room_type_amenities enable row level security;

alter table public.room_rates enable row level security;
alter table public.rate_overrides enable row level security;
alter table public.room_type_inventory enable row level security;

alter table public.guests enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_rooms enable row level security;
alter table public.payments enable row level security;
alter table public.inventory_blocks enable row level security;

alter table public.cancellation_policies enable row level security;

alter table public.admin_profiles enable row level security;


-- ============================================================
-- 20. PUBLIC READ POLICIES
--
-- 고객 사이트에서 필요한 공개정보만 허용
-- ============================================================

create policy "public read hotel settings"
on public.hotel_settings
for select
to anon, authenticated
using (true);


create policy "public read sellable room types"
on public.room_types
for select
to anon, authenticated
using (
  is_sellable = true
);


create policy "public read active amenities"
on public.amenities
for select
to anon, authenticated
using (
  is_active = true
);


create policy "public read room type amenities"
on public.room_type_amenities
for select
to anon, authenticated
using (true);


create policy "public read room rates"
on public.room_rates
for select
to anon, authenticated
using (true);


create policy "public read rate overrides"
on public.rate_overrides
for select
to anon, authenticated
using (true);


create policy "public read cancellation policies"
on public.cancellation_policies
for select
to anon, authenticated
using (
  is_active = true
);


-- ============================================================
-- IMPORTANT
--
-- rooms
-- room_type_inventory
-- guests
-- reservations
-- reservation_rooms
-- payments
-- inventory_blocks
--
-- 는 anon에게 직접 공개하지 않는다.
--
-- 실제 예약 생성 / 재고 확인은
-- 향후 검증된 PostgreSQL RPC 또는
-- Supabase Edge Function에서 처리한다.
-- ============================================================


-- ============================================================
-- 21. ADMIN RLS POLICIES
-- ============================================================

create policy "admin manage hotel settings"
on public.hotel_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage room types"
on public.room_types
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage rooms"
on public.rooms
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage amenities"
on public.amenities
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage room amenities"
on public.room_amenities
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage room type amenities"
on public.room_type_amenities
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage room rates"
on public.room_rates
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage rate overrides"
on public.rate_overrides
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage inventory"
on public.room_type_inventory
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage guests"
on public.guests
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage reservations"
on public.reservations
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage reservation rooms"
on public.reservation_rooms
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage payments"
on public.payments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage inventory blocks"
on public.inventory_blocks
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


create policy "admin manage cancellation policies"
on public.cancellation_policies
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- 관리자 본인은 자신의 profile 확인 가능
create policy "admin read own profile"
on public.admin_profiles
for select
to authenticated
using (
  user_id = auth.uid()
);


-- ============================================================
-- 22. DATA API PRIVILEGES
--
-- Supabase 프로젝트 생성 시
-- Automatically expose new tables = OFF
-- 로 설정했기 때문에 필요한 권한을 명시한다.
-- ============================================================


-- ------------------------------------------------------------
-- PUBLIC
-- ------------------------------------------------------------

grant select
on public.hotel_settings
to anon, authenticated;

grant select
on public.room_types
to anon, authenticated;

grant select
on public.amenities
to anon, authenticated;

grant select
on public.room_type_amenities
to anon, authenticated;

grant select
on public.room_rates
to anon, authenticated;

grant select
on public.rate_overrides
to anon, authenticated;

grant select
on public.cancellation_policies
to anon, authenticated;


-- ------------------------------------------------------------
-- AUTHENTICATED / ADMIN
--
-- 실제 접근 가능 여부는 RLS + is_admin()이 결정한다.
-- ------------------------------------------------------------

grant select, insert, update, delete
on public.hotel_settings
to authenticated;

grant select, insert, update, delete
on public.room_types
to authenticated;

grant select, insert, update, delete
on public.rooms
to authenticated;

grant select, insert, update, delete
on public.amenities
to authenticated;

grant select, insert, update, delete
on public.room_amenities
to authenticated;

grant select, insert, update, delete
on public.room_type_amenities
to authenticated;

grant select, insert, update, delete
on public.room_rates
to authenticated;

grant select, insert, update, delete
on public.rate_overrides
to authenticated;

grant select, insert, update, delete
on public.room_type_inventory
to authenticated;

grant select, insert, update, delete
on public.guests
to authenticated;

grant select, insert, update, delete
on public.reservations
to authenticated;

grant select, insert, update, delete
on public.reservation_rooms
to authenticated;

grant select, insert, update, delete
on public.payments
to authenticated;

grant select, insert, update, delete
on public.inventory_blocks
to authenticated;

grant select, insert, update, delete
on public.cancellation_policies
to authenticated;

grant select
on public.admin_profiles
to authenticated;


-- ============================================================
-- END OF INITIAL SCHEMA
-- ============================================================
