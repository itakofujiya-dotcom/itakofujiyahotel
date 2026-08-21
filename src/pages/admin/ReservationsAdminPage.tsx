import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { ReservationCalendar } from '../../features/admin-reservations/ReservationCalendar'
import { ReservationsTable } from '../../features/admin-reservations/ReservationsTable'
import {
  buildReservationFilterSearchParams,
  filterReservations,
  bookingSourceLabels,
  countNewOnlineReservations,
  createDefaultReservationFilters,
  parseReservationFilters,
  reservationStatusLabels,
} from '../../features/admin-reservations/reservation-helpers'
import type {
  BookingSource,
  ReservationFilters,
  ReservationStatus,
} from '../../features/admin-reservations/types'
import { useAdminReservations } from '../../features/admin-reservations/useAdminReservations'

export function ReservationsAdminPage() {
  const [params, setParams] = useSearchParams()
  const paramsKey = params.toString()
  const initialFilters = parseReservationFilters(params)
  const hasInitialListFilter = hasListFilter(params)
  const [view, setView] = useState<'list' | 'calendar'>(
    hasInitialListFilter ? 'list' : 'calendar',
  )
  const [filters, setFilters] = useState<ReservationFilters>(initialFilters)
  const { reservations, isLoading, error, loadReservations } =
    useAdminReservations()
  const filtered = useMemo(
    () => filterReservations(reservations, filters),
    [reservations, filters],
  )
  const newCount = countNewOnlineReservations(reservations)

  useEffect(() => {
    const nextParams = new URLSearchParams(paramsKey)
    setFilters(parseReservationFilters(nextParams))
    if (hasListFilter(nextParams)) setView('list')
  }, [paramsKey])

  function showNewOnly() {
    const next = { ...createDefaultReservationFilters(), newOnly: true }
    setFilters(next)
    setView('list')
    setParams(buildReservationFilterSearchParams(next))
  }

  function resetFilters(nextView: 'list' | 'calendar') {
    setFilters(createDefaultReservationFilters())
    setParams({})
    setView(nextView)
  }

  function changeFilters(next: ReservationFilters) {
    setFilters(next)
    setParams(buildReservationFilterSearchParams(next))
    setView('list')
  }

  return (
    <>
      <AdminPageHeader
        title="予約管理"
        description="予約一覧・宿泊カレンダー・お客様情報を管理します。"
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            resetFilters('calendar')
          }}
          className={`min-h-11 px-5 text-sm font-semibold ${view === 'calendar' && !filters.newOnly ? 'bg-moss text-white' : 'border border-line bg-surface'}`}
        >
          カレンダー
        </button>
        <button
          type="button"
          onClick={() => {
            resetFilters('list')
          }}
          className={`min-h-11 px-5 text-sm font-semibold ${view === 'list' && !filters.newOnly ? 'bg-moss text-white' : 'border border-line bg-surface'}`}
        >
          一覧
        </button>
        <button
          type="button"
          onClick={showNewOnly}
          className={`min-h-11 px-5 text-sm font-semibold ${filters.newOnly ? 'bg-moss text-white' : 'border border-line bg-surface'}`}
        >
          新規予約 {newCount}件
        </button>
        <Link
          to="/admin/reservations/new"
          className="ml-auto inline-flex min-h-11 items-center bg-accent px-5 text-sm font-semibold text-white"
        >
          電話・管理者予約を登録
        </Link>
      </div>

      {isLoading ? (
        <StatePanel text="予約情報を読み込んでいます..." />
      ) : error ? (
        <StatePanel
          text={error}
          actionLabel="再読み込み"
          onAction={() => void loadReservations()}
        />
      ) : view === 'calendar' ? (
        <ReservationCalendar reservations={reservations} />
      ) : (
        <div className="space-y-5">
          <ReservationFiltersPanel filters={filters} onChange={changeFilters} />
          <ReservationsTable reservations={filtered} />
        </div>
      )}
    </>
  )
}

function ReservationFiltersPanel({
  filters,
  onChange,
}: {
  filters: ReservationFilters
  onChange: (filters: ReservationFilters) => void
}) {
  return (
    <div className="grid gap-3 border border-line bg-surface p-4 md:grid-cols-2 xl:grid-cols-4">
      <label>
        <span className="mb-2 block text-xs font-semibold text-muted">
          運営フィルター
        </span>
        <select
          className="admin-input"
          value={filters.operation}
          onChange={(event) =>
            onChange({
              ...filters,
              operation: event.target.value as ReservationFilters['operation'],
            })
          }
        >
          <option value="all">すべて</option>
          <option value="today_check_in">有効なチェックイン</option>
          <option value="today_check_out">有効なチェックアウト</option>
        </select>
      </label>
      <label>
        <span className="mb-2 block text-xs font-semibold text-muted">
          予約状態
        </span>
        <select
          className="admin-input"
          value={filters.status}
          onChange={(event) =>
            onChange({
              ...filters,
              status: event.target.value as ReservationStatus | 'all',
            })
          }
        >
          <option value="all">すべて</option>
          {Object.entries(reservationStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-2 block text-xs font-semibold text-muted">
          チェックアウト日
        </span>
        <input
          type="date"
          className="admin-input"
          value={filters.checkOut}
          onChange={(event) =>
            onChange({ ...filters, checkOut: event.target.value })
          }
        />
      </label>
      <label>
        <span className="mb-2 block text-xs font-semibold text-muted">
          宿泊日
        </span>
        <input
          type="date"
          className="admin-input"
          value={filters.stayDate}
          onChange={(event) =>
            onChange({ ...filters, stayDate: event.target.value })
          }
        />
      </label>
      <label>
        <span className="mb-2 block text-xs font-semibold text-muted">
          入金状態
        </span>
        <select
          className="admin-input"
          value={filters.payment}
          onChange={(event) =>
            onChange({
              ...filters,
              payment: event.target.value as ReservationFilters['payment'],
            })
          }
        >
          <option value="all">すべて</option>
          <option value="bank_transfer_pending">銀行振込・入金待ち</option>
        </select>
      </label>
      <label>
        <span className="mb-2 block text-xs font-semibold text-muted">
          予約経路
        </span>
        <select
          className="admin-input"
          value={filters.source}
          onChange={(event) =>
            onChange({
              ...filters,
              source: event.target.value as BookingSource | 'all',
            })
          }
        >
          <option value="all">すべて</option>
          {Object.entries(bookingSourceLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-2 block text-xs font-semibold text-muted">
          チェックイン日
        </span>
        <input
          type="date"
          className="admin-input"
          value={filters.checkIn}
          onChange={(event) =>
            onChange({ ...filters, checkIn: event.target.value })
          }
        />
      </label>
      <label>
        <span className="mb-2 block text-xs font-semibold text-muted">
          検索
        </span>
        <input
          className="admin-input"
          placeholder="予約番号・氏名・電話番号"
          value={filters.search}
          onChange={(event) =>
            onChange({ ...filters, search: event.target.value })
          }
        />
      </label>
    </div>
  )
}

function hasListFilter(params: URLSearchParams): boolean {
  return [
    'view',
    'status',
    'source',
    'checkIn',
    'checkOut',
    'stayDate',
    'payment',
    'operation',
    'search',
  ].some((key) => params.has(key))
}

function StatePanel({
  text,
  actionLabel,
  onAction,
}: {
  text: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div
      className="border border-line bg-surface p-12 text-center"
      role="status"
    >
      <p className="text-sm text-muted">{text}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 min-h-11 border border-line px-5 text-sm font-semibold"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
