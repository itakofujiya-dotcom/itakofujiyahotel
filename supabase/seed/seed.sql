-- ============================================================
-- 潮来富士屋ホテル
-- Initial Seed Data
-- ============================================================
--
-- 현재 확정된 실제 호텔 운영정보만 입력한다.
--
-- 포함:
--   1. 호텔 기본정보
--   2. 객실 상품 (和室 / 洋室)
--   3. 실제 객실 40실
--   4. 객실 어메니티
--   5. 기본 인원별 요금
--   6. 취소 규정
--
-- 포함하지 않음:
--   - 날짜별 온라인 판매수량
--   - 날짜별 특별요금
--   - 관리자 계정
--   - 실제 예약
-- ============================================================


-- ============================================================
-- 1. HOTEL SETTINGS
-- ============================================================

update public.hotel_settings
set
  hotel_name_ja = '潮来富士屋ホテル',
  hotel_name_en = 'ITAKO FUJIYA HOTEL',
  hotel_name_ko = '이타코 후지야 호텔',

  postal_code = '311-2424',
  address_ja = '茨城県潮来市潮来102',

  telephone = '0299-62-2000',
  fax = '0299-63-0801',
  email = 'itakofujiya@gmail.com',

  map_url = 'https://goo.gl/maps/GwPmVZCzfNbi5CRZ9',

  check_in_time = '15:00',
  check_out_time = '10:00',

  front_desk_open = '15:00',
  front_desk_close = '22:00',

  max_booking_days = 40,
  max_stay_nights = 10,
  same_day_booking_cutoff = '12:00',

  pets_allowed = false,

  updated_at = now();


insert into public.hotel_settings (
  hotel_name_ja,
  hotel_name_en,
  hotel_name_ko,

  postal_code,
  address_ja,

  telephone,
  fax,
  email,

  map_url,

  check_in_time,
  check_out_time,

  front_desk_open,
  front_desk_close,

  max_booking_days,
  max_stay_nights,
  same_day_booking_cutoff,

  pets_allowed
)
select
  '潮来富士屋ホテル',
  'ITAKO FUJIYA HOTEL',
  '이타코 후지야 호텔',

  '311-2424',
  '茨城県潮来市潮来102',

  '0299-62-2000',
  '0299-63-0801',
  'itakofujiya@gmail.com',

  'https://goo.gl/maps/GwPmVZCzfNbi5CRZ9',

  '15:00',
  '10:00',

  '15:00',
  '22:00',

  40,
  10,
  '12:00',

  false

where not exists (
  select 1
  from public.hotel_settings
);


-- ============================================================
-- 2. ROOM TYPES
--
-- 고객에게 판매하는 객실 상품은
-- 和室 / 洋室 두 종류만 사용한다.
--
-- 1호 라인은 별도 상품으로 분리하지 않는다.
-- ============================================================

insert into public.room_types (
  code,

  name_ja,
  name_en,
  name_ko,

  description_ja,
  description_en,
  description_ko,

  standard_capacity,
  max_capacity,

  is_sellable,
  display_order
)
values
(
  'japanese',

  '和室',
  'Japanese Room',
  '일본식 객실',

  '落ち着いた和の空間で、ゆっくりとお過ごしいただける客室です。',
  'A traditional Japanese-style room for a comfortable and relaxing stay.',
  '편안하고 차분하게 머물 수 있는 일본식 객실입니다.',

  2,
  4,

  true,
  1
),
(
  'western',

  '洋室',
  'Western Room',
  '양실',

  'ベッドを備えた洋室タイプの客室です。',
  'A Western-style guest room equipped with beds.',
  '침대가 마련된 서양식 객실입니다.',

  2,
  4,

  true,
  2
)
on conflict (code)
do update set

  name_ja = excluded.name_ja,
  name_en = excluded.name_en,
  name_ko = excluded.name_ko,

  description_ja = excluded.description_ja,
  description_en = excluded.description_en,
  description_ko = excluded.description_ko,

  standard_capacity = excluded.standard_capacity,
  max_capacity = excluded.max_capacity,

  is_sellable = excluded.is_sellable,
  display_order = excluded.display_order,

  updated_at = now();


-- ============================================================
-- 3. PHYSICAL ROOMS
--
-- 전체 40실
--
-- 洋室 13실
-- 和室 27실
--
-- 洋室:
--
-- 2층 전체
-- 201 202 203 205 206 207 208 210
--
-- 1호 라인
-- 301 401 501 601
--
-- 별도
-- 307
--
-- 501호는 실제 洋室이지만
-- 기본 온라인 판매중지(inactive)
-- ============================================================


-- ------------------------------------------------------------
-- 2F
-- 전 객실 洋室
-- ------------------------------------------------------------

insert into public.rooms (
  room_number,
  floor,
  room_style,
  room_type_id,
  standard_capacity,
  max_capacity,
  sales_status,
  operations_note
)
values

(
  '201',
  2,
  'western',
  (select id from public.room_types where code = 'western'),
  4,
  4,
  'active',
  '1号ライン'
),

(
  '202',
  2,
  'western',
  (select id from public.room_types where code = 'western'),
  2,
  4,
  'active',
  null
),

(
  '203',
  2,
  'western',
  (select id from public.room_types where code = 'western'),
  2,
  4,
  'active',
  null
),

(
  '205',
  2,
  'western',
  (select id from public.room_types where code = 'western'),
  2,
  4,
  'active',
  null
),

(
  '206',
  2,
  'western',
  (select id from public.room_types where code = 'western'),
  2,
  4,
  'active',
  null
),

(
  '207',
  2,
  'western',
  (select id from public.room_types where code = 'western'),
  2,
  4,
  'active',
  null
),

(
  '208',
  2,
  'western',
  (select id from public.room_types where code = 'western'),
  2,
  4,
  'active',
  null
),

(
  '210',
  2,
  'western',
  (select id from public.room_types where code = 'western'),
  2,
  4,
  'active',
  null
),


-- ------------------------------------------------------------
-- 3F
-- ------------------------------------------------------------

(
  '301',
  3,
  'western',
  (select id from public.room_types where code = 'western'),
  4,
  4,
  'active',
  '1号ライン'
),

(
  '302',
  3,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '303',
  3,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '305',
  3,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '306',
  3,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '307',
  3,
  'western',
  (select id from public.room_types where code = 'western'),
  2,
  4,
  'active',
  null
),

(
  '308',
  3,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '310',
  3,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),


-- ------------------------------------------------------------
-- 4F
-- ------------------------------------------------------------

(
  '401',
  4,
  'western',
  (select id from public.room_types where code = 'western'),
  4,
  4,
  'active',
  '1号ライン'
),

(
  '402',
  4,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '403',
  4,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '405',
  4,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '406',
  4,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '407',
  4,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '408',
  4,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '410',
  4,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),


-- ------------------------------------------------------------
-- 5F
-- ------------------------------------------------------------

(
  '501',
  5,
  'western',
  (select id from public.room_types where code = 'western'),
  4,
  4,
  'inactive',
  'ダブルベッド。通常は販売停止。必要に応じて管理画面から販売可能に変更する。'
),

(
  '502',
  5,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '503',
  5,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '505',
  5,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '506',
  5,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '507',
  5,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '508',
  5,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '510',
  5,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),


-- ------------------------------------------------------------
-- 6F
-- ------------------------------------------------------------

(
  '601',
  6,
  'western',
  (select id from public.room_types where code = 'western'),
  4,
  4,
  'active',
  '1号ライン'
),

(
  '602',
  6,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '603',
  6,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '605',
  6,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '606',
  6,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '607',
  6,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '608',
  6,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
),

(
  '610',
  6,
  'japanese',
  (select id from public.room_types where code = 'japanese'),
  2,
  4,
  'active',
  null
)

on conflict (room_number)
do update set

  floor = excluded.floor,
  room_style = excluded.room_style,
  room_type_id = excluded.room_type_id,

  standard_capacity = excluded.standard_capacity,
  max_capacity = excluded.max_capacity,

  sales_status = excluded.sales_status,
  operations_note = excluded.operations_note,

  updated_at = now();


-- ============================================================
-- 4. AMENITIES
-- ============================================================

insert into public.amenities (
  code,
  name_ja,
  name_en,
  name_ko,
  category,
  provided_by_default,
  icon_key,
  display_order,
  is_active
)
values

(
  'wifi',
  '無料Wi-Fi',
  'Free Wi-Fi',
  '무료 Wi-Fi',
  'facility',
  true,
  'wifi',
  1,
  true
),

(
  'air-conditioner',
  'エアコン',
  'Air Conditioning',
  '에어컨',
  'facility',
  true,
  'air-conditioner',
  2,
  true
),

(
  'tv',
  'テレビ',
  'TV',
  'TV',
  'facility',
  true,
  'tv',
  3,
  true
),

(
  'refrigerator',
  '冷蔵庫',
  'Refrigerator',
  '냉장고',
  'facility',
  true,
  'refrigerator',
  4,
  true
),

(
  'electric-kettle',
  '電気ポット',
  'Electric Kettle',
  '전기포트',
  'facility',
  true,
  'kettle',
  5,
  true
),

(
  'hair-dryer',
  'ドライヤー',
  'Hair Dryer',
  '드라이기',
  'facility',
  true,
  'hair-dryer',
  6,
  true
),

(
  'bathroom',
  'バス',
  'Private Bath',
  '욕실',
  'bathroom',
  true,
  'bath',
  7,
  true
),

(
  'toilet',
  'トイレ',
  'Toilet',
  '화장실',
  'bathroom',
  true,
  'toilet',
  8,
  true
),

(
  'non-smoking',
  '全室禁煙',
  'Non-Smoking',
  '전 객실 금연',
  'facility',
  true,
  'non-smoking',
  9,
  true
),

(
  'toothbrush',
  '歯ブラシ',
  'Toothbrush',
  '칫솔',
  'amenity',
  true,
  'toothbrush',
  10,
  true
),

(
  'towel',
  'タオル',
  'Towel',
  '수건',
  'amenity',
  true,
  'towel',
  11,
  true
),

(
  'shampoo',
  'シャンプー',
  'Shampoo',
  '샴푸',
  'bathroom',
  true,
  'shampoo',
  12,
  true
),

(
  'conditioner',
  'コンディショナー',
  'Conditioner',
  '컨디셔너',
  'bathroom',
  true,
  'conditioner',
  13,
  true
),

(
  'body-wash',
  'ボディソープ',
  'Body Wash',
  '바디워시',
  'bathroom',
  true,
  'body-wash',
  14,
  true
),

(
  'slippers',
  'スリッパ',
  'Slippers',
  '슬리퍼',
  'amenity',
  true,
  'slippers',
  15,
  true
)

on conflict (code)
do update set

  name_ja = excluded.name_ja,
  name_en = excluded.name_en,
  name_ko = excluded.name_ko,

  category = excluded.category,
  provided_by_default = excluded.provided_by_default,

  icon_key = excluded.icon_key,
  display_order = excluded.display_order,

  is_active = excluded.is_active,

  updated_at = now();


-- ============================================================
-- 5. ROOM TYPE ↔ AMENITIES
--
-- 현재 확인된 객실 어메니티는
-- 和室 / 洋室 모두 공통 제공
-- ============================================================

insert into public.room_type_amenities (
  room_type_id,
  amenity_id
)

select
  rt.id,
  a.id

from public.room_types rt

cross join public.amenities a

where
  rt.code in ('japanese', 'western')
  and a.provided_by_default = true
  and a.is_active = true

on conflict (
  room_type_id,
  amenity_id
)
do nothing;


-- ============================================================
-- 6. BASE ROOM RATES
--
-- 가격은 모두 세금 포함
--
-- 고객 화면:
--   1인당 가격
--   +
--   객실 총액
--
-- 둘 다 표시 예정
--
-- valid_to는 초기 기본요금 적용기간을
-- 넉넉하게 설정.
--
-- 특정 날짜 가격 변경은
-- rate_overrides에서 처리한다.
-- ============================================================


-- ------------------------------------------------------------
-- 和室
--
-- 1인  13,500円 / person
-- 2인   8,500円 / person
-- 3인   8,500円 / person
-- 4인   8,500円 / person
-- ------------------------------------------------------------

insert into public.room_rates (
  room_type_id,
  guest_count,
  valid_from,
  valid_to,
  price_per_person_yen
)
values

(
  (select id from public.room_types where code = 'japanese'),
  1,
  '2026-08-20',
  '2099-12-31',
  13500
),

(
  (select id from public.room_types where code = 'japanese'),
  2,
  '2026-08-20',
  '2099-12-31',
  8500
),

(
  (select id from public.room_types where code = 'japanese'),
  3,
  '2026-08-20',
  '2099-12-31',
  8500
),

(
  (select id from public.room_types where code = 'japanese'),
  4,
  '2026-08-20',
  '2099-12-31',
  8500
),


-- ------------------------------------------------------------
-- 洋室
--
-- 1인  15,500円 / person
-- 2인   9,500円 / person
-- 3인   9,500円 / person
-- 4인   9,500円 / person
-- ------------------------------------------------------------

(
  (select id from public.room_types where code = 'western'),
  1,
  '2026-08-20',
  '2099-12-31',
  15500
),

(
  (select id from public.room_types where code = 'western'),
  2,
  '2026-08-20',
  '2099-12-31',
  9500
),

(
  (select id from public.room_types where code = 'western'),
  3,
  '2026-08-20',
  '2099-12-31',
  9500
),

(
  (select id from public.room_types where code = 'western'),
  4,
  '2026-08-20',
  '2099-12-31',
  9500
)

on conflict (
  room_type_id,
  guest_count,
  valid_from,
  valid_to
)
do update set

  price_per_person_yen =
    excluded.price_per_person_yen,

  updated_at = now();


-- ============================================================
-- 7. CANCELLATION POLICIES
--
-- 체크인 기준
--
-- 7일 전까지        무료
-- 6~4일 전         30%
-- 3~2일 전         50%
-- 전날              100%
-- 당일              100%
-- No-show           100%
-- ============================================================


-- ------------------------------------------------------------
-- 7일 이상 전
-- ------------------------------------------------------------

insert into public.cancellation_policies (
  code,

  min_days_before,
  max_days_before,

  fee_percent,
  is_no_show,

  description_ja,
  description_en,
  description_ko,

  display_order,
  is_active
)
values
(
  'free_7_plus',

  7,
  null,

  0,
  false,

  '宿泊日の7日前まで：キャンセル料無料',
  'Free cancellation until 7 days before check-in.',
  '체크인 7일 전까지 무료 취소',

  1,
  true
),


-- ------------------------------------------------------------
-- 6~4일 전
-- ------------------------------------------------------------

(
  'days_6_to_4',

  4,
  6,

  30,
  false,

  '宿泊日の6～4日前：宿泊料金の30％',
  '6 to 4 days before check-in: 30% cancellation fee.',
  '체크인 6~4일 전: 숙박요금의 30%',

  2,
  true
),


-- ------------------------------------------------------------
-- 3~2일 전
-- ------------------------------------------------------------

(
  'days_3_to_2',

  2,
  3,

  50,
  false,

  '宿泊日の3～2日前：宿泊料金の50％',
  '3 to 2 days before check-in: 50% cancellation fee.',
  '체크인 3~2일 전: 숙박요금의 50%',

  3,
  true
),


-- ------------------------------------------------------------
-- 전날
-- ------------------------------------------------------------

(
  'previous_day',

  1,
  1,

  100,
  false,

  '宿泊日前日：宿泊料金の100％',
  '1 day before check-in: 100% cancellation fee.',
  '체크인 전날: 숙박요금의 100%',

  4,
  true
),


-- ------------------------------------------------------------
-- 당일
-- ------------------------------------------------------------

(
  'same_day',

  0,
  0,

  100,
  false,

  '宿泊日当日：宿泊料金の100％',
  'On the day of check-in: 100% cancellation fee.',
  '체크인 당일: 숙박요금의 100%',

  5,
  true
),


-- ------------------------------------------------------------
-- No-show
-- ------------------------------------------------------------

(
  'no_show',

  null,
  null,

  100,
  true,

  '無連絡不泊：宿泊料金の100％',
  'No-show: 100% cancellation fee.',
  '노쇼: 숙박요금의 100%',

  6,
  true
)

on conflict (code)
do update set

  min_days_before =
    excluded.min_days_before,

  max_days_before =
    excluded.max_days_before,

  fee_percent =
    excluded.fee_percent,

  is_no_show =
    excluded.is_no_show,

  description_ja =
    excluded.description_ja,

  description_en =
    excluded.description_en,

  description_ko =
    excluded.description_ko,

  display_order =
    excluded.display_order,

  is_active =
    excluded.is_active,

  updated_at = now();


-- ============================================================
-- 8. IMPORTANT OPERATION NOTES
-- ============================================================
--
-- 아래 데이터는 아직 seed하지 않는다.
--
-- ------------------------------------------------------------
-- room_type_inventory
-- ------------------------------------------------------------
--
-- 관리자가 날짜별 온라인 판매수량을 직접 설정한다.
--
-- 실제 객실:
--   和室 27실
--   洋室 13실
--
-- 하지만 온라인 판매수량은
-- 실제 객실 수와 별개로 운영한다.
--
--
-- ------------------------------------------------------------
-- rate_overrides
-- ------------------------------------------------------------
--
-- 기본 요금 이외의 특정 날짜 가격은
-- 관리자 페이지에서 직접 설정한다.
--
--
-- ------------------------------------------------------------
-- payments
-- ------------------------------------------------------------
--
-- 초기 결제수단:
--   pay_at_hotel
--
-- 현장:
--   현금
--   신용카드
--
-- bank_transfer / card 온라인 결제는
-- 현재 UI에서 사용하지 않는다.
--
--
-- ------------------------------------------------------------
-- reservations
-- ------------------------------------------------------------
--
-- 현재 온라인 예약은
-- 예약 완료 즉시 confirmed 상태로 생성한다.
--
-- DB default는 future compatibility를 위해
-- pending 상태를 유지한다.
--
--
-- ------------------------------------------------------------
-- CHILD POLICY
-- ------------------------------------------------------------
--
-- 미취학 아동:
--
-- 부모와 침구 공유
-- → 무료
-- → 객실 정원 계산에서 제외
--
-- 별도 침구 사용
-- → 유료 인원으로 계산
--
-- 초등학생 이상
-- → 성인요금
--
--
-- ------------------------------------------------------------
-- 501 ROOM
-- ------------------------------------------------------------
--
-- 실제 객실:
--   洋室
--   더블베드
--
-- 기본:
--   inactive
--
-- 필요 시 관리자가
-- active로 변경하여 판매 가능.
--
--
-- ------------------------------------------------------------
-- PETS
-- ------------------------------------------------------------
--
-- 애완동물 동반 불가
--
--
-- ------------------------------------------------------------
-- YUKATA
-- ------------------------------------------------------------
--
-- 유카타 제공 없음
--
-- ============================================================
-- END OF SEED
-- ============================================================
