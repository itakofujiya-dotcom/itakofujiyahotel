import { Outlet, ScrollRestoration } from 'react-router-dom'
import { Footer } from '../components/layout/Footer'
import { Header } from '../components/layout/Header'
import { MobileBookingCta } from '../components/layout/MobileBookingCta'
import { PublicSeo } from '../components/common/PublicSeo'

export function PublicLayout() {
  return (
    <div data-site-i18n-root>
      <PublicSeo />
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
