import { supabase } from '../../lib/supabase/client'
import type { AdminRoom, RoomSalesStatus } from './types'

export async function fetchAdminRooms(): Promise<AdminRoom[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select(
      `
        id,
        room_number,
        floor,
        room_style,
        standard_capacity,
        max_capacity,
        sales_status,
        operations_note,
        room_types (
          id,
          code,
          name_ja
        )
      `,
    )
    .order('room_number', { ascending: true })

  if (error) {
    console.error('[Admin rooms] Failed to load rooms.', {
      code: error.code,
      message: error.message,
    })
    throw new Error('ROOMS_FETCH_FAILED')
  }

  return data.map((room) => ({
    id: room.id,
    room_number: room.room_number,
    floor: room.floor,
    room_style: room.room_style,
    standard_capacity: room.standard_capacity,
    max_capacity: room.max_capacity,
    sales_status: room.sales_status,
    operations_note: room.operations_note,
    room_type: room.room_types,
  }))
}

export async function updateAdminRoomSalesStatus(
  roomId: string,
  salesStatus: Extract<RoomSalesStatus, 'active' | 'inactive'>,
): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ sales_status: salesStatus })
    .eq('id', roomId)
    .select('id')
    .single()

  if (error) {
    console.error('[Admin rooms] Failed to update room sales status.', {
      code: error.code,
      message: error.message,
    })
    throw new Error('ROOM_STATUS_UPDATE_FAILED')
  }
}
