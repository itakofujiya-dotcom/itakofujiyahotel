import { useEffect, useRef } from 'react'
import { getVisibleRoomSelectionState, roomStyleLabels } from './room-helpers'
import { RoomStatusBadge } from './RoomStatusBadge'
import type { AdminRoom, RoomSalesStatus } from './types'

type EditableStatus = Extract<RoomSalesStatus, 'active' | 'inactive'>

export function RoomsTable({
  rooms,
  updatingRoomId,
  selectedRoomIds,
  isBulkUpdating,
  onToggleRoom,
  onToggleAllVisible,
  onRequestStatusChange,
}: {
  rooms: AdminRoom[]
  updatingRoomId: string | null
  selectedRoomIds: ReadonlySet<string>
  isBulkUpdating: boolean
  onToggleRoom: (roomId: string) => void
  onToggleAllVisible: () => void
  onRequestStatusChange: (room: AdminRoom, nextStatus: EditableStatus) => void
}) {
  const selectAllRef = useRef<HTMLInputElement>(null)
  const selectionState = getVisibleRoomSelectionState(
    rooms.map((room) => room.id),
    selectedRoomIds,
  )

  useEffect(() => {
    if (selectAllRef.current)
      selectAllRef.current.indeterminate = selectionState.indeterminate
  }, [selectionState.indeterminate])

  if (rooms.length === 0) {
    return (
      <div className="border border-dashed border-line bg-surface p-12 text-center text-sm text-muted">
        条件に一致する客室がありません。
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-[#eceeea] text-xs text-muted">
          <tr>
            <th scope="col" className="px-4 py-4 font-semibold">
              <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={selectionState.checked}
                  disabled={isBulkUpdating}
                  onChange={onToggleAllVisible}
                  aria-label="表示中の客室をすべて選択"
                  className="size-4 accent-[#42523f]"
                />
                <span>すべて選択</span>
              </label>
            </th>
            {[
              '客室番号',
              '階',
              'タイプ',
              '基準人数',
              '最大人数',
              '販売状態',
              '運営メモ',
              '操作',
            ].map((item) => (
              <th key={item} scope="col" className="px-4 py-4 font-semibold">
                {item}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rooms.map((room) => {
            const nextStatus =
              room.sales_status === 'active' ? 'inactive' : 'active'
            const canToggle =
              room.sales_status === 'active' || room.sales_status === 'inactive'
            return (
              <tr key={room.id} className="hover:bg-background/60">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedRoomIds.has(room.id)}
                    disabled={isBulkUpdating}
                    onChange={() => onToggleRoom(room.id)}
                    aria-label={`${room.room_number}号室を選択`}
                    className="size-4 accent-[#42523f]"
                  />
                </td>
                <th scope="row" className="px-4 py-4 font-semibold">
                  {room.room_number}
                </th>
                <td className="px-4 py-4">{room.floor}F</td>
                <td className="px-4 py-4">
                  {room.room_type?.name_ja ?? roomStyleLabels[room.room_style]}
                </td>
                <td className="px-4 py-4">{room.standard_capacity}名</td>
                <td className="px-4 py-4">{room.max_capacity}名</td>
                <td className="px-4 py-4">
                  <RoomStatusBadge status={room.sales_status} />
                </td>
                <td className="max-w-64 px-4 py-4 text-xs leading-6 text-muted">
                  {room.operations_note ?? '—'}
                </td>
                <td className="px-4 py-4">
                  {canToggle ? (
                    <button
                      type="button"
                      onClick={() => onRequestStatusChange(room, nextStatus)}
                      disabled={isBulkUpdating || updatingRoomId === room.id}
                      aria-label={`${room.room_number}号室を${room.sales_status === 'active' ? '販売停止' : '販売再開'}する`}
                      className="min-h-10 border border-line px-3 text-xs font-semibold transition hover:border-moss hover:text-moss disabled:opacity-50"
                    >
                      {room.sales_status === 'active'
                        ? '販売停止にする'
                        : '販売を再開する'}
                    </button>
                  ) : (
                    <span className="text-xs text-muted">変更不可</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
