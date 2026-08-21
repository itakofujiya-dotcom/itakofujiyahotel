import { useCallback, useEffect, useState } from 'react'
import {
  fetchAdminRooms,
  updateAdminRoomSalesStatus,
  updateAdminRoomsSalesStatus,
} from './admin-rooms-api'
import type { AdminRoom, RoomSalesStatus } from './types'

export function useAdminRooms() {
  const [rooms, setRooms] = useState<AdminRoom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingRoomId, setUpdatingRoomId] = useState<string | null>(null)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)

  const loadRooms = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setRooms(await fetchAdminRooms())
    } catch {
      setError('客室情報の取得に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRooms()
  }, [loadRooms])

  const updateSalesStatus = useCallback(
    async (
      roomId: string,
      nextStatus: Extract<RoomSalesStatus, 'active' | 'inactive'>,
    ): Promise<boolean> => {
      setUpdatingRoomId(roomId)
      setError(null)
      try {
        await updateAdminRoomSalesStatus(roomId, nextStatus)
        setRooms((current) =>
          current.map((room) =>
            room.id === roomId ? { ...room, sales_status: nextStatus } : room,
          ),
        )
        return true
      } catch {
        setError(
          '販売状態を変更できませんでした。時間をおいて再度お試しください。',
        )
        return false
      } finally {
        setUpdatingRoomId(null)
      }
    },
    [],
  )

  const updateBulkSalesStatus = useCallback(
    async (
      roomIds: string[],
      nextStatus: Extract<RoomSalesStatus, 'active' | 'inactive'>,
    ): Promise<boolean> => {
      setIsBulkUpdating(true)
      setError(null)
      try {
        await updateAdminRoomsSalesStatus(roomIds, nextStatus)
        setRooms(await fetchAdminRooms())
        return true
      } catch {
        setError('客室の販売状態を更新できませんでした。')
        return false
      } finally {
        setIsBulkUpdating(false)
      }
    },
    [],
  )

  return {
    rooms,
    isLoading,
    error,
    updatingRoomId,
    isBulkUpdating,
    loadRooms,
    updateSalesStatus,
    updateBulkSalesStatus,
  }
}
