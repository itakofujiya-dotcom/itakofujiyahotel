import { useEffect, useRef } from 'react'
import type { AdminRoom, RoomSalesStatus } from './types'

type EditableStatus = Extract<RoomSalesStatus, 'active' | 'inactive'>

export function RoomsBulkStatusDialog({
  selectedRooms,
  editableRooms,
  protectedRooms,
  nextStatus,
  isUpdating,
  onCancel,
  onConfirm,
}: {
  selectedRooms: AdminRoom[]
  editableRooms: AdminRoom[]
  protectedRooms: AdminRoom[]
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

  const stopping = nextStatus === 'inactive'
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="rooms-bulk-status-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!isUpdating) onCancel()
      }}
      className="w-[calc(100%-2rem)] max-w-lg bg-transparent p-0 backdrop:bg-black/45"
    >
      <div className="bg-surface p-7 shadow-soft sm:p-8">
        <p className="eyebrow">BULK UPDATE</p>
        <h2 id="rooms-bulk-status-dialog-title" className="font-serif text-2xl">
          {stopping
            ? '選択した客室を販売停止にしますか？'
            : '選択した客室の販売を再開しますか？'}
        </h2>
        <p className="mt-5 font-semibold">対象: {selectedRooms.length}室</p>
        <p className="mt-1 text-sm text-muted">
          変更対象: {editableRooms.length}室
        </p>
        <p className="mt-4 text-sm leading-7 text-muted">
          {editableRooms
            .slice(0, 8)
            .map((room) => `${room.room_number}号室`)
            .join('、')}
          {editableRooms.length > 8 && `、ほか${editableRooms.length - 8}室`}
        </p>
        {protectedRooms.length > 0 && (
          <p className="mt-4 border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            {protectedRooms.length}
            室は管理者専用またはメンテナンス中のため変更されません。
          </p>
        )}
        {stopping && (
          <p className="mt-4 text-sm leading-7 text-muted">
            選択した客室はオンライン販売対象から外れます。
          </p>
        )}
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
            disabled={isUpdating || editableRooms.length === 0}
            className="min-h-11 bg-moss px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isUpdating
              ? '変更しています…'
              : stopping
                ? '販売停止にする'
                : '販売を再開する'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
