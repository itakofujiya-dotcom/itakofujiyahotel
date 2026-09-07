# 예약 재고 오류 수정 및 검증

## 확인한 원인

`202608210007_mixed_room_meal_plans.sql`의 `create_admin_reservation`은 고객·예약·객실을 INSERT하기 전 재고를 검사하지 않았다. 관리자 UI는 `get_admin_inventory_availability`에서 잔여 0을 받아도, 예약 생성 RPC는 그대로 확정 예약을 저장할 수 있었다. 실제 PostgreSQL에서 **양일 재고 0 → 관리자 확정 예약 생성 성공**을 재현했다.

고객의 `create_public_mixed_reservation`과 구형 `create_public_reservation`에는 원래 요청 ID/객실 타입 advisory lock 및 서버 재조회가 있었다. 따라서 고객 두 요청끼리의 잠금 자체가 없었던 것은 아니다. 그러나 관리자 생성, 판매수량 변경, 직접 테이블 변경에는 동일한 보호가 없어 그 경로들과 경합하거나 재고 검사를 우회할 수 있었다. DB 차원의 조건부 차감 및 음수 방지 잔여 재고 제약도 없었다.

또한 고객 혼합 예약, 구형 예약, 검색에 재고 계산이 중복돼 있었고, 독립적인 `inventory_blocks` 날짜 차단은 기존 계산에 반영되지 않았다.

이것은 코드와 수정 전 재현으로 확인한 원인이다. 신고된 실제 예약 건의 생성 경로까지 단정할 수는 없다. 운영 예약의 `booking_source`, `created_at`, `booking_request_id`, 당시 관리자 재고 변경 및 RPC 로그를 확인해야 한다. 원인 조사에서는 운영 예약 데이터나 호출 로그를 조회하지 않았다. 이후 사용자 요청에 따라 아래 마이그레이션을 운영 DB에 적용했다.

## 통일한 계산 기준

- 기본 객실 수: 해당 타입의 `rooms.sales_status = 'active'` 호실 수.
- 날짜 차단: `inventory_blocks` 중 예약 배정에 연결되지 않은 독립 차단(`reservation_room_id IS NULL`), `held/active`, 해당 숙박일 포함, 만료되지 않은 호실을 기본 수에서 제외한다. 예약 배정용 블록은 기존 예약과 중복 차감하지 않는다.
- 상품 판매중지: `room_types.is_sellable = false`이면 판매 가능 수 0.
- 날짜 판매중지: `room_type_inventory.sellable_quantity = 0`이면 0.
- 관리자 판매수량은 잔여 재고가 아니라 **판매 상한**이다. 미설정일은 기본 수를 사용하고, 설정일은 `min(판매 상한, 날짜 차단 반영 기본 수)`를 사용한다.
- 점유 수량: `pending`, `confirmed`, `checked_in` 예약의 `reservation_rooms` 행 수. 호실이 미배정이어도 1행당 1실 차감한다.
- 잔여 수량: `max(판매 상한 - 점유 수량, 0)`.
- 체크인 포함, 체크아웃 제외. 여러 날짜의 최솟값을 표시하고, 요청된 각 타입의 객실 수 전체를 모든 숙박일에 적용한다.
- 취소/기존 종료 상태는 점유에서 제외한다. 취소 제한·수수료·자동 취소 정책은 변경하지 않았다.

관리자 달력, 고객 검색, 혼합 견적, 구형 예약 검증, 최종 DB 차감이 모두 `calculate_room_type_availability`를 사용한다.

## DB 처리

`202609070001_atomic_booking_inventory.sql`은 예약, 예약 객실, 판매수량, 호실, 객실 타입, 날짜 차단의 모든 INSERT/UPDATE/DELETE에 트랜잭션 공통 mutex 행 잠금을 적용한다. 고객 RPC는 최종 재조회 전에도 이 잠금을 획득한다. 실제 행 UPDATE이므로 더 강한 격리 수준에서 오래된 snapshot을 유지한 요청은 serialization failure로 실패한다. PostgreSQL의 [트리거 데이터 가시성](https://www.postgresql.org/docs/16/trigger-datachanges.html) 및 [트랜잭션 격리](https://www.postgresql.org/docs/current/transaction-iso.html) 규칙에 따른다.

`booking_inventory_balance`에 날짜별 점유·잔여를 보관한다. 점유 증가 시 `UPDATE ... SET remaining = remaining - v_delta WHERE remaining >= v_delta`가 실제로 적용됐는지 검사하며, 영향 행이 없으면 `INSUFFICIENT_INVENTORY` 예외를 발생시킨다. `remaining >= 0` CHECK를 추가했다. 트리거 예외는 예약·고객·각 날짜 차감·결제·알림 outbox까지 해당 RPC의 트랜잭션을 롤백한다. 기존 중복 요청 ID 처리는 유지한다.

관리자가 기존 예약보다 낮은 판매 상한을 설정하면 기존 예약은 보존하고 추가 판매만 닫는다. 취소 시 현재 상한을 기준으로 복원하므로 판매중지 상태에서 취소해도 다시 판매가 열리지 않는다. 마이그레이션은 기존 예약을 기준으로 초기화하며 과거 오버부킹을 삭제하거나 취소하지 않는다.

이 구현은 호텔 전체 재고 변경을 직렬화하고 저장 시 기록된 숙박일을 재계산하는 보수적인 방식이다. 예약량·기록이 크게 늘면 성능 측정 후 잠금과 재계산 범위를 타입/날짜별로 좁힐 수 있다. 현재 우선순위는 모든 우회 저장 경로의 일관된 차단이다.

고객 UI 구조는 유지했다. 재고 부족 코드와 DB 오류를 기존 재선택 흐름에 연결하고 요청된 한국어·일본어 메시지를 사용한다.

## 실행한 검증

임시 PostgreSQL 18.4의 독립된 DB에서 프로젝트 마이그레이션과 seed를 적용했다. Supabase auth 함수만 로컬 대체하고 pg_cron/pg_net 스케줄 설치는 제외했다. 실제 운영 Supabase/PostgREST 배포 환경 테스트는 아니다.

- A: 재고 0, 예약 실패 및 예약 수 불변.
- B: 서로 다른 연결에서 마지막 1실 경쟁. 두 번째 요청이 첫 트랜잭션 커밋까지 기다리고 정확히 1건 성공.
- C: 재고 2, 3실 요청 실패.
- D: 두 번째 숙박일 재고 0이면 전체 실패.
- E: 2실 예약으로 양일 3→1 차감, 동일 요청 ID 재시도 시 추가 차감 없음.
- F: 실제 고객 취소 RPC 및 관리자 취소 RPC로 전 날짜 복원. 고객 취소 재요청은 기존 ALREADY_CANCELLED 정책을 유지하고 추가 복원 없음.
- G: 관리자 날짜 판매수량 0 및 이전 견적을 사용한 예약 실패.
- 추가: 상품 판매중지, 독립 호실 차단, 구형 RPC, 관리자/고객 표시 일치, 혼합 타입 부족, 관리자 우회 저장 거절, 두 번째 객실 실패 시 첫 객실 차감 및 고객 생성 롤백, 관리자 판매중지와 고객 요청의 동시 실행, 음수 CHECK.
- 기존 예약·검색 20개, 관리자 재고 17개, 취소 22개 테스트 통과.
- TypeScript/Vite build 및 ESLint 확인.

재현 명령(임시 의존성, 운영 환경파일 사용 안 함):

```sh
npm install --prefix /tmp/hotel-inventory-db embedded-postgres@18.4.0-beta.17 pg@8.23.0
INVENTORY_TEST_MODULE_ROOT=/tmp/hotel-inventory-db npm run test:inventory:db
```

테스트는 로컬 55440 포트에 임시 PostgreSQL을 자동 시작하고 종료·정리한다. 해당 포트가 비어 있어야 한다. 테스트 DB는 매번 새로 생성한다.

## 적용 상태

2026-09-07 사용자 요청으로 연결된 운영 Supabase 프로젝트 `qzawzuaupikwyzgibtcf`에 `202609070001_atomic_booking_inventory.sql` 적용 완료. CLI는 자동 트랜잭션을 제공하지 않아 파일에 명시적인 BEGIN/COMMIT을 추가했으며, 전체 DB 통합 테스트를 재실행한 후 적용했다. 최초 시도는 첫 LOCK TABLE 문에서 실패하여 데이터 변경 없이 중단됐다. 재적용은 성공했다. 고객 메시지 변경은 Git main 푸시에 포함하며 실제 프론트 배포 완료 여부는 별도 확인 대상이다. 기존 예약 데이터는 보존되므로 이미 발생한 오버부킹의 객실 배정 조정은 별도 운영 확인이 필요하다.
