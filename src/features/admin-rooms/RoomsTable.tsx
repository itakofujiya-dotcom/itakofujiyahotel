import { roomStyleLabels } from './room-helpers'
import { RoomStatusBadge } from './RoomStatusBadge'
import type { AdminRoom, RoomSalesStatus } from './types'

type EditableStatus = Extract<RoomSalesStatus, 'active' | 'inactive'>

export function RoomsTable({
  rooms,
  updatingRoomId,
  onRequestStatusChange,
}: {
  rooms: AdminRoom[]
  updatingRoomId: string | null
  onRequestStatusChange: (room: AdminRoom, nextStatus: EditableStatus) => void
}) {
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
                      disabled={updatingRoomId === room.id}
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
