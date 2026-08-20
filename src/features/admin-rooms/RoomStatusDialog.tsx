import { useEffect, useRef } from 'react'
import type { AdminRoom, RoomSalesStatus } from './types'

type EditableStatus = Extract<RoomSalesStatus, 'active' | 'inactive'>

export function RoomStatusDialog({
  room,
  nextStatus,
  isUpdating,
  onCancel,
  onConfirm,
}: {
  room: AdminRoom
  nextStatus: EditableStatus
  isUpdating: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  const message =
    nextStatus === 'active'
      ? `${room.room_number}号室の販売を再開しますか？`
      : `${room.room_number}号室を販売停止にしますか？`

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="room-status-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!isUpdating) onCancel()
      }}
      className="w-[calc(100%-2rem)] max-w-md bg-transparent p-0 backdrop:bg-black/45"
    >
      <div className="bg-surface p-7 shadow-soft sm:p-8">
        <p className="eyebrow">CONFIRM</p>
        <h2 id="room-status-dialog-title" className="font-serif text-2xl">
          販売状態の変更
        </h2>
        <p className="mt-5 leading-7 text-muted">{message}</p>
        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isUpdating}
            className="min-h-11 border border-line px-5 text-sm font-semibold disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isUpdating}
            className="min-h-11 bg-moss px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isUpdating ? '変更しています…' : '変更する'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
