import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { physicalRooms } from '../../data/rooms'
import type { RoomSalesStatus } from '../../types/domain'

const statusLabel: Record<RoomSalesStatus, string> = {
  active: '販売中',
  inactive: '販売停止',
  admin_only: '管理者専用',
  maintenance: '点検中',
}
export function RoomsAdminPage() {
  return (
    <>
      <AdminPageHeader
        title="客室管理"
        description={`物理客室 ${physicalRooms.length}室の基本情報です。`}
      />
      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#eceeea] text-xs text-muted">
            <tr>
              {[
                '客室番号',
                '階',
                '客室形態',
                '基本人数',
                '最大人数',
                '販売状態',
              ].map((item) => (
                <th key={item} className="px-5 py-4 font-semibold">
                  {item}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {physicalRooms.map((room) => (
              <tr key={room.roomNumber} className="hover:bg-background/60">
                <td className="px-5 py-4 font-semibold">{room.roomNumber}</td>
                <td className="px-5 py-4">{room.floor}F</td>
                <td className="px-5 py-4">
                  {room.style === 'western' ? '洋室' : '和室'}
                </td>
                <td className="px-5 py-4">{room.standardCapacity}名</td>
                <td className="px-5 py-4">{room.maxCapacity}名</td>
                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${room.salesStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-stone-200 text-stone-700'}`}
                  >
                    {statusLabel[room.salesStatus]}
                  </span>
                  {room.operationsNote && (
                    <span className="ml-2 text-xs text-muted">
                      {room.operationsNote}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
