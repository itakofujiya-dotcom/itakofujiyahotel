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

export function isBulkEditableRoom(room: AdminRoom): boolean {
  return room.sales_status === 'active' || room.sales_status === 'inactive'
}

export function getBulkRoomStatusPlan(
  rooms: AdminRoom[],
  selectedRoomIds: ReadonlySet<string>,
) {
  const selectedRooms = rooms.filter((room) => selectedRoomIds.has(room.id))
  return {
    selectedRooms,
    editableRooms: selectedRooms.filter(isBulkEditableRoom),
    protectedRooms: selectedRooms.filter((room) => !isBulkEditableRoom(room)),
  }
}

export function applyRoomStatusToSelection(
  rooms: AdminRoom[],
  selectedRoomIds: ReadonlySet<string>,
  nextStatus: Extract<RoomSalesStatus, 'active' | 'inactive'>,
): AdminRoom[] {
  return rooms.map((room) =>
    selectedRoomIds.has(room.id) && isBulkEditableRoom(room)
      ? { ...room, sales_status: nextStatus }
      : room,
  )
}

export function toggleRoomSelection(
  selectedRoomIds: ReadonlySet<string>,
  roomId: string,
): Set<string> {
  const next = new Set(selectedRoomIds)
  if (next.has(roomId)) next.delete(roomId)
  else next.add(roomId)
  return next
}

export function toggleVisibleRoomSelection(
  selectedRoomIds: ReadonlySet<string>,
  visibleRoomIds: string[],
): Set<string> {
  const next = new Set(selectedRoomIds)
  const allVisibleSelected =
    visibleRoomIds.length > 0 &&
    visibleRoomIds.every((roomId) => next.has(roomId))
  if (allVisibleSelected)
    visibleRoomIds.forEach((roomId) => next.delete(roomId))
  else visibleRoomIds.forEach((roomId) => next.add(roomId))
  return next
}

export function getVisibleRoomSelectionState(
  visibleRoomIds: string[],
  selectedRoomIds: ReadonlySet<string>,
) {
  const selectedCount = visibleRoomIds.filter((roomId) =>
    selectedRoomIds.has(roomId),
  ).length
  return {
    selectedCount,
    checked:
      visibleRoomIds.length > 0 && selectedCount === visibleRoomIds.length,
    indeterminate: selectedCount > 0 && selectedCount < visibleRoomIds.length,
  }
}
