import { useMemo, useState } from 'react'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import {
  filterAdminRooms,
  getBulkRoomStatusPlan,
  summarizeAdminRooms,
  toggleRoomSelection,
  toggleVisibleRoomSelection,
} from '../../features/admin-rooms/room-helpers'
import { RoomFilters } from '../../features/admin-rooms/RoomFilters'
import { RoomsBulkStatusDialog } from '../../features/admin-rooms/RoomsBulkStatusDialog'
import { RoomStatusDialog } from '../../features/admin-rooms/RoomStatusDialog'
import { RoomsTable } from '../../features/admin-rooms/RoomsTable'
import type {
  AdminRoom,
  RoomFilters as RoomFiltersValue,
  RoomSalesStatus,
} from '../../features/admin-rooms/types'
import { useAdminRooms } from '../../features/admin-rooms/useAdminRooms'

type EditableStatus = Extract<RoomSalesStatus, 'active' | 'inactive'>
type PendingChange = { room: AdminRoom; nextStatus: EditableStatus }

const initialFilters: RoomFiltersValue = {
  floor: 'all',
  style: 'all',
  status: 'all',
}

export function RoomsAdminPage() {
  const {
    rooms,
    isLoading,
    error,
    updatingRoomId,
    isBulkUpdating,
    loadRooms,
    updateSalesStatus,
    updateBulkSalesStatus,
  } = useAdminRooms()
  const [filters, setFilters] = useState(initialFilters)
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null)
  const [pendingBulkStatus, setPendingBulkStatus] =
    useState<EditableStatus | null>(null)
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [feedback, setFeedback] = useState<string | null>(null)
  const summary = useMemo(() => summarizeAdminRooms(rooms), [rooms])
  const filteredRooms = useMemo(
    () => filterAdminRooms(rooms, filters),
    [rooms, filters],
  )
  const bulkPlan = useMemo(
    () => getBulkRoomStatusPlan(rooms, selectedRoomIds),
    [rooms, selectedRoomIds],
  )

  async function confirmStatusChange() {
    if (!pendingChange) return
    const succeeded = await updateSalesStatus(
      pendingChange.room.id,
      pendingChange.nextStatus,
    )
    if (succeeded) setPendingChange(null)
  }

  function changeFilters(nextFilters: RoomFiltersValue) {
    setFilters(nextFilters)
    setSelectedRoomIds(new Set())
    setFeedback(null)
  }

  function toggleRoom(roomId: string) {
    setSelectedRoomIds((current) => toggleRoomSelection(current, roomId))
  }

  function toggleAllVisible() {
    setSelectedRoomIds((current) =>
      toggleVisibleRoomSelection(
        current,
        filteredRooms.map((room) => room.id),
      ),
    )
  }

  async function confirmBulkStatusChange() {
    if (!pendingBulkStatus || bulkPlan.editableRooms.length === 0) return
    const protectedCount = bulkPlan.protectedRooms.length
    const updatedCount = bulkPlan.editableRooms.length
    const succeeded = await updateBulkSalesStatus(
      bulkPlan.editableRooms.map((room) => room.id),
      pendingBulkStatus,
    )
    if (!succeeded) return
    setPendingBulkStatus(null)
    setSelectedRoomIds(new Set())
    setFeedback(
      `${updatedCount}室の販売状態を更新しました。${protectedCount > 0 ? `${protectedCount}室は管理者専用またはメンテナンス中のため変更されませんでした。` : ''}`,
    )
  }

  return (
    <>
      <AdminPageHeader
        title="客室管理"
        description="物理客室の販売状態を確認・変更します。"
      />

      {isLoading ? (
        <RoomsLoading />
      ) : rooms.length === 0 && error ? (
        <RoomsLoadError message={error} onRetry={loadRooms} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="全客室" value={summary.total} />
            <SummaryCard label="販売中" value={summary.active} tone="green" />
            <SummaryCard label="販売停止" value={summary.inactive} />
            <SummaryCard label="和室" value={summary.japanese} />
            <SummaryCard label="洋室" value={summary.western} />
          </div>

          {error && (
            <div
              className="flex flex-wrap items-center justify-between gap-4 border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              role="alert"
            >
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void loadRooms()}
                className="min-h-10 border border-red-300 px-4 font-semibold"
              >
                再読み込み
              </button>
            </div>
          )}

          {feedback && (
            <p
              className="border border-green-200 bg-green-50 p-4 text-sm leading-7 text-green-900"
              role="status"
            >
              {feedback}
            </p>
          )}

          <RoomFilters
            filters={filters}
            onChange={changeFilters}
            resultCount={filteredRooms.length}
          />
          <section className="flex flex-wrap items-center gap-3 border border-line bg-surface p-4">
            <p className="mr-auto text-sm font-semibold">
              選択中: {selectedRoomIds.size}室
            </p>
            <button
              type="button"
              onClick={() => {
                setFeedback(null)
                setPendingBulkStatus('inactive')
              }}
              disabled={
                selectedRoomIds.size === 0 ||
                isBulkUpdating ||
                updatingRoomId !== null
              }
              className="min-h-11 border border-line px-4 text-sm font-semibold transition hover:border-red-700 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              選択した客室を販売停止
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback(null)
                setPendingBulkStatus('active')
              }}
              disabled={
                selectedRoomIds.size === 0 ||
                isBulkUpdating ||
                updatingRoomId !== null
              }
              className="min-h-11 bg-moss px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              選択した客室の販売を再開
            </button>
          </section>
          {rooms.length === 0 ? (
            <div className="border border-dashed border-line bg-surface p-12 text-center text-sm text-muted">
              登録されている客室がありません。
            </div>
          ) : (
            <RoomsTable
              rooms={filteredRooms}
              updatingRoomId={updatingRoomId}
              selectedRoomIds={selectedRoomIds}
              isBulkUpdating={isBulkUpdating}
              onToggleRoom={toggleRoom}
              onToggleAllVisible={toggleAllVisible}
              onRequestStatusChange={(room, nextStatus) =>
                setPendingChange({ room, nextStatus })
              }
            />
          )}
        </div>
      )}

      {pendingChange && (
        <RoomStatusDialog
          room={pendingChange.room}
          nextStatus={pendingChange.nextStatus}
          isUpdating={updatingRoomId === pendingChange.room.id}
          onCancel={() => setPendingChange(null)}
          onConfirm={() => void confirmStatusChange()}
        />
      )}
      {pendingBulkStatus && (
        <RoomsBulkStatusDialog
          selectedRooms={bulkPlan.selectedRooms}
          editableRooms={bulkPlan.editableRooms}
          protectedRooms={bulkPlan.protectedRooms}
          nextStatus={pendingBulkStatus}
          isUpdating={isBulkUpdating}
          onCancel={() => setPendingBulkStatus(null)}
          onConfirm={() => void confirmBulkStatusChange()}
        />
      )}
    </>
  )
}

function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'green'
}) {
  return (
    <article className="border border-line bg-surface p-5">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p
        className={`mt-3 text-3xl font-semibold ${tone === 'green' ? 'text-green-800' : 'text-ink'}`}
      >
        {value}
        <span className="ml-1 text-sm font-normal text-muted">室</span>
      </p>
    </article>
  )
}

function RoomsLoading() {
  return (
    <div
      className="border border-line bg-surface p-12 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-line border-t-moss" />
      <p className="mt-4 text-sm text-muted">客室情報を読み込んでいます…</p>
    </div>
  )
}

function RoomsLoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div
      className="border border-red-200 bg-red-50 p-10 text-center"
      role="alert"
    >
      <p className="text-sm leading-7 text-red-800">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 min-h-11 border border-red-300 px-5 text-sm font-semibold text-red-800"
      >
        再読み込み
      </button>
    </div>
  )
}
