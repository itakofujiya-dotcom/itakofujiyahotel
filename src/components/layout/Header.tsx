import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { CalendarDays, Menu, X } from 'lucide-react'
import { publicNavigation } from '../../data/navigation'
import { hotelSettings } from '../../data/hotel'

export function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-surface/95 backdrop-blur">
      <div className="page-shell flex h-20 items-center justify-between gap-5 lg:h-24">
        <Link
          to="/"
          className="flex flex-col"
          onClick={() => setOpen(false)}
          aria-label="潮来富士屋ホテル ホーム"
        >
          <span className="font-serif text-lg tracking-[0.12em] sm:text-xl">
            {hotelSettings.hotelNameJa}
          </span>
          <span className="mt-1 text-[9px] tracking-[0.28em] text-muted">
            {hotelSettings.hotelNameEn}
          </span>
        </Link>
        <nav
          className="hidden items-center gap-6 lg:flex"
          aria-label="メインナビゲーション"
        >
          {publicNavigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `py-3 text-sm transition hover:text-accent ${isActive ? 'text-accent' : 'text-ink'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/booking"
            className="hidden min-h-12 items-center gap-2 bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover sm:flex"
          >
            <CalendarDays size={17} />
            宿泊予約
          </Link>
          <button
            className="grid size-12 place-items-center lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          className="border-t border-line bg-surface px-5 pb-6 pt-2 lg:hidden"
          aria-label="モバイルナビゲーション"
        >
          {publicNavigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="block border-b border-line/70 py-4 text-sm"
            >
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/booking"
            onClick={() => setOpen(false)}
            className="mt-5 flex min-h-12 items-center justify-center bg-accent text-sm font-semibold text-white"
          >
            宿泊予約
          </Link>
        </nav>
      )}
    </header>
  )
}
