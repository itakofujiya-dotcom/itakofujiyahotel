export function NewReservationBadge({
  compact = false,
}: {
  compact?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-red-600 font-bold tracking-wider text-white shadow-sm ${compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'}`}
      aria-label="新規オンライン予約"
    >
      NEW
    </span>
  )
}
