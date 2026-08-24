import { Link } from 'react-router-dom'
import { hotelSettings, hotelTelephoneHref } from '../../data/hotel'
import { publicNavigation } from '../../data/navigation'
import { useSiteTranslation } from '../../i18n/useSiteTranslation'

export function Footer() {
  const { translate } = useSiteTranslation()
  return (
    <footer className="bg-[#2f332d] pb-24 pt-16 text-white/80 sm:pb-10">
      <div className="page-shell grid gap-12 md:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="font-serif text-2xl tracking-widest text-white">
            {hotelSettings.hotelNameJa}
          </p>
          <p className="mt-2 text-xs tracking-[0.25em]">
            {hotelSettings.hotelNameEn}
          </p>
          <address className="mt-7 text-sm not-italic leading-7">
            〒{hotelSettings.postalCode}
            <br />
            {hotelSettings.addressJa}
            <br />
            <a href={hotelTelephoneHref} className="hover:text-white">
              TEL {hotelSettings.telephone}
            </a>
            <span className="ml-4">FAX {hotelSettings.fax}</span>
          </address>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {publicNavigation.map((item) => (
            <Link key={item.to} to={item.to} className="hover:text-white">
              {translate(item.label)}
            </Link>
          ))}
          <Link to="/policies">ご利用案内</Link>
          <Link to="/reservation">予約確認</Link>
        </div>
      </div>
      <div className="page-shell mt-12 border-t border-white/15 pt-6 text-xs text-white/45">
        © {new Date().getFullYear()} ITAKO FUJIYA HOTEL
      </div>
    </footer>
  )
}
