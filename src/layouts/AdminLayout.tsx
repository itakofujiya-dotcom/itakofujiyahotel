import { useCallback, useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { adminNavigation } from '../data/navigation'
import { hotelSettings } from '../data/hotel'
import { adminRoleLabels } from '../features/auth/authorization'
import { useAdminAuth } from '../features/auth/use-admin-auth'
import {
  adminReservationSeenEvent,
  fetchNewOnlineReservationCount,
} from '../features/admin-reservations/admin-reservations-api'

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { adminProfile, logout } = useAdminAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [newReservationCount, setNewReservationCount] = useState(0)

  const loadNewReservationCount = useCallback(async () => {
    try {
      setNewReservationCount(await fetchNewOnlineReservationCount())
    } catch {
      setNewReservationCount(0)
    }
  }, [])

  useEffect(() => {
    void loadNewReservationCount()
  }, [loadNewReservationCount, location.pathname, location.search])

  useEffect(() => {
    const refresh = () => void loadNewReservationCount()
    window.addEventListener(adminReservationSeenEvent, refresh)
    return () => window.removeEventListener(adminReservationSeenEvent, refresh)
  }, [loadNewReservationCount])

  async function handleLogout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f2f3f1]">
      <header className="flex items-center justify-between border-b border-line bg-surface px-5 py-4 lg:hidden">
        <div>
          <p className="font-serif">{hotelSettings.hotelNameJa}</p>
          <p className="mt-1 text-xs text-muted">
            {adminProfile?.display_name} ·{' '}
            {adminProfile ? adminRoleLabels[adminProfile.role] : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex min-h-11 items-center gap-2 px-3 text-xs text-muted disabled:opacity-50"
        >
          <LogOut size={16} /> ログアウト
        </button>
      </header>
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[250px_1fr]">
        <aside className="hidden bg-[#26302b] p-7 text-white lg:block">
          <p className="font-serif text-lg">{hotelSettings.hotelNameJa}</p>
          <p className="mt-1 text-[10px] tracking-[.25em] text-white/50">
            ADMINISTRATION
          </p>
          <nav className="mt-12 space-y-1">
            {adminNavigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                className={({ isActive }) =>
                  `block px-4 py-3 text-sm transition ${isActive ? 'bg-white/12 text-white' : 'text-white/65 hover:text-white'}`
                }
              >
                <AdminNavigationLabel
                  label={item.label}
                  showCount={item.to === '/admin/reservations'}
                  count={newReservationCount}
                />
              </NavLink>
            ))}
          </nav>
          <div className="mt-10 border-t border-white/15 pt-6">
            <p className="text-sm font-medium">
              {adminProfile?.display_name ?? '管理者'}
            </p>
            <p className="mt-1 text-xs text-white/50">
              {adminProfile ? adminRoleLabels[adminProfile.role] : ''}
            </p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-xs text-white/65 transition hover:text-white disabled:opacity-50"
            >
              <LogOut size={15} />
              {isLoggingOut ? 'ログアウト中…' : 'ログアウト'}
            </button>
          </div>
        </aside>
        <div>
          <nav className="flex gap-1 overflow-x-auto border-b border-line bg-surface p-2 lg:hidden">
            {adminNavigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                className={({ isActive }) =>
                  `shrink-0 px-3 py-2 text-xs ${isActive ? 'bg-moss text-white' : 'text-muted'}`
                }
              >
                <AdminNavigationLabel
                  label={item.label}
                  showCount={item.to === '/admin/reservations'}
                  count={newReservationCount}
                />
              </NavLink>
            ))}
          </nav>
          <main className="p-5 sm:p-8 lg:p-12">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

function AdminNavigationLabel({
  label,
  showCount,
  count,
}: {
  label: string
  showCount: boolean
  count: number
}) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span>{label}</span>
      {showCount && count > 0 && (
        <span
          className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
          aria-label={`新規予約 ${count}件`}
        >
          {count}
        </span>
      )}
    </span>
  )
}
