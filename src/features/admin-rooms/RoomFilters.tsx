import { roomSalesStatusLabels } from './room-helpers'
import type { RoomFilters as RoomFiltersValue } from './types'

export function RoomFilters({
  filters,
  onChange,
  resultCount,
}: {
  filters: RoomFiltersValue
  onChange: (filters: RoomFiltersValue) => void
  resultCount: number
}) {
  return (
    <section
      className="border border-line bg-surface p-5"
      aria-labelledby="room-filter-heading"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="room-filter-heading" className="text-sm font-semibold">
          絞り込み
        </h2>
        <p className="text-xs text-muted">表示 {resultCount}室</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label>
          <span className="mb-2 block text-xs font-semibold text-muted">
            階
          </span>
          <select
            className="admin-input"
            value={filters.floor}
            onChange={(event) =>
              onChange({
                ...filters,
                floor:
                  event.target.value === 'all'
                    ? 'all'
                    : Number(event.target.value),
              })
            }
          >
            <option value="all">すべて</option>
            {[2, 3, 4, 5, 6].map((floor) => (
              <option key={floor} value={floor}>
                {floor}F
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-xs font-semibold text-muted">
            客室タイプ
          </span>
          <select
            className="admin-input"
            value={filters.style}
            onChange={(event) =>
              onChange({
                ...filters,
                style: event.target.value as RoomFiltersValue['style'],
              })
            }
          >
            <option value="all">すべて</option>
            <option value="japanese">和室</option>
            <option value="western">洋室</option>
          </select>
        </label>
        <label>
          <span className="mb-2 block text-xs font-semibold text-muted">
            販売状態
          </span>
          <select
            className="admin-input"
            value={filters.status}
            onChange={(event) =>
              onChange({
                ...filters,
                status: event.target.value as RoomFiltersValue['status'],
              })
            }
          >
            <option value="all">すべて</option>
            {Object.entries(roomSalesStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}
