import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'

export function MobileBookingCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface p-3 sm:hidden">
      <Link
        to="/booking"
        className="flex min-h-12 items-center justify-center gap-2 bg-accent font-semibold text-white"
      >
        <CalendarDays size={18} />
        空室検索・宿泊予約
      </Link>
    </div>
  )
}
