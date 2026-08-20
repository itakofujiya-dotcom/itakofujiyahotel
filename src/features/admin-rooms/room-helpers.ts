import type {
  AdminRoom,
  RoomFilters,
  RoomSalesStatus,
  RoomStyle,
} from './types'

export const roomSalesStatusLabels: Record<RoomSalesStatus, string> = {
  active: '販売中',
  inactive: '販売停止',
  admin_only: '管理者専用',
  maintenance: 'メンテナンス',
}

export const roomStyleLabels: Record<RoomStyle, string> = {
  japanese: '和室',
  western: '洋室',
}

export function getRoomSalesStatusLabel(status: RoomSalesStatus): string {
  return roomSalesStatusLabels[status]
}

export function filterAdminRooms(
  rooms: AdminRoom[],
  filters: RoomFilters,
): AdminRoom[] {
  return rooms.filter(
    (room) =>
      (filters.floor === 'all' || room.floor === filters.floor) &&
      (filters.style === 'all' || room.room_style === filters.style) &&
      (filters.status === 'all' || room.sales_status === filters.status),
  )
}

export function summarizeAdminRooms(rooms: AdminRoom[]) {
  return {
    total: rooms.length,
    active: rooms.filter((room) => room.sales_status === 'active').length,
    inactive: rooms.filter((room) => room.sales_status === 'inactive').length,
    japanese: rooms.filter((room) => room.room_style === 'japanese').length,
    western: rooms.filter((room) => room.room_style === 'western').length,
  }
}
