import { Outlet, ScrollRestoration } from 'react-router-dom'
import { Footer } from '../components/layout/Footer'
import { Header } from '../components/layout/Header'
import { MobileBookingCta } from '../components/layout/MobileBookingCta'

export function PublicLayout() {
  return (
    <div data-site-i18n-root>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <MobileBookingCta />
      <ScrollRestoration />
    </div>
  )
}
