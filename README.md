# 潮来富士屋ホテル reservation site

React + TypeScript + Vite로 구축한 호텔 사이트 및 예약 운영 시스템의 초기 기반입니다. 기본 언어는 일본어이며, 공개 사이트와 관리자 화면을 하나의 앱 안에서 서로 다른 layout으로 분리했습니다.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Supabase를 아직 연결하지 않아도 공개/관리자 UI를 확인할 수 있습니다. 환경변수가 비어 있으면 Supabase client는 생성되지 않습니다.

## Commands

```bash
npm run lint
npm run build
npm run format:check
```

## Main structure

- `src/app`: router entry
- `src/components`: reusable public, booking, room, admin components
- `src/data`: confirmed hotel, access, room, amenity data
- `src/features`: booking validation and future feature logic
- `src/layouts`: separated public/admin layouts
- `src/lib/supabase`: environment-safe Supabase client
- `src/pages`: public and admin route screens
- `src/types`: domain and generated-database type boundaries
- `public/images`: replaceable hotel image groups
- `supabase/migrations`: schema, constraints, RLS baseline
- `supabase/seed`: confirmed hotel data, 40 physical rooms, amenities

## Data status

Confirmed data includes the hotel contact details and operating hours supplied for this project, access directions, 40 physical room numbers, Japanese/western room classification, capacity assumptions explicitly supplied, room 501's provisional inactive state, and common amenities.

No prices, room areas, cancellation rules, booking confirmation policy, pickup conditions, or card-payment behavior have been invented. Saleable `room_types` and rate rows are intentionally absent from the database seed until hotel operations confirms them.

## Booking safety boundary

Anonymous browser users do not receive table-write RLS policies. A future server-side RPC or Edge Function must atomically validate input and write the guest, reservation, payment, and inventory allocation. `inventory_blocks` uses a PostgreSQL exclusion constraint over checkout-exclusive date ranges (`[check_in, check_out)`) to prevent overlapping allocations for one physical room.
