import { useEffect, useRef, type ReactNode } from 'react'

export function RateConfirmDialog({
  title,
  description,
  children,
  confirmLabel = '変更する',
  isMutating,
  destructive = false,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  children?: ReactNode
  confirmLabel?: string
  isMutating: boolean
  destructive?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="rate-confirm-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!isMutating) onCancel()
      }}
      className="w-[calc(100%-2rem)] max-w-lg bg-transparent p-0 backdrop:bg-black/45"
    >
      <div className="bg-surface p-7 shadow-soft sm:p-8">
        <p className="eyebrow">CONFIRM</p>
        <h2 id="rate-confirm-title" className="font-serif text-2xl">
          {title}
        </h2>
        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted">
          {description}
        </p>
        {children}
        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isMutating}
            className="min-h-11 border border-line px-5 text-sm font-semibold disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isMutating}
            className={`min-h-11 px-5 text-sm font-semibold text-white disabled:opacity-50 ${destructive ? 'bg-red-700' : 'bg-moss'}`}
          >
            {isMutating ? '処理しています…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
