import { NavLink, Outlet } from 'react-router-dom'
import { adminNavigation } from '../data/navigation'
import { hotelSettings } from '../data/hotel'

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#f2f3f1]">
      <header className="border-b border-line bg-surface px-5 py-4 lg:hidden">
        <p className="font-serif">
          {hotelSettings.hotelNameJa}{' '}
          <span className="ml-2 text-xs text-muted">管理画面</span>
        </p>
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
                {item.label}
              </NavLink>
            ))}
          </nav>
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
                {item.label}
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
