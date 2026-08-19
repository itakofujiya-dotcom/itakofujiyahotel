import { Car, ExternalLink, Phone, TrainFront } from 'lucide-react'
import { PageHero } from '../../components/common/PageHero'
import { accessInfo, hotelSettings } from '../../data/hotel'

export function AccessPage() {
  return (
    <>
      <PageHero
        eyebrow="ACCESS"
        title="アクセス"
        description="水郷のまち・潮来で、皆さまをお待ちしています。"
        image="/images/access/entrance.webp"
      />
      <section className="page-shell py-16 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-2">
          <AccessCard icon={TrainFront} title="電車でお越しの方">
            <p>{accessInfo.train}</p>
            <p className="mt-4">{accessInfo.pickup}</p>
            <p className="mt-2 text-sm text-muted">
              ※ {accessInfo.pickupNotice}
            </p>
          </AccessCard>
          <AccessCard icon={Car} title="お車でお越しの方">
            <p>{accessInfo.car}</p>
          </AccessCard>
        </div>
        <div className="mt-12 grid gap-8 bg-surface p-7 shadow-soft sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="eyebrow">LOCATION</p>
            <h2 className="font-serif text-2xl">{hotelSettings.hotelNameJa}</h2>
            <address className="mt-4 not-italic leading-8 text-muted">
              〒{hotelSettings.postalCode}
              <br />
              {hotelSettings.addressJa}
            </address>
            <a
              href={`tel:${hotelSettings.telephone}`}
              className="mt-4 inline-flex items-center gap-2 font-medium"
            >
              <Phone size={17} />
              {hotelSettings.telephone}
            </a>
          </div>
          <a
            href={hotelSettings.mapUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-accent px-6 text-sm font-semibold text-white"
          >
            Google Mapsで開く <ExternalLink size={16} />
          </a>
        </div>
      </section>
    </>
  )
}
function AccessCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Car
  title: string
  children: React.ReactNode
}) {
  return (
    <article className="border border-line bg-surface p-8 sm:p-10">
      <Icon size={30} className="text-accent" />
      <h2 className="mt-5 font-serif text-2xl">{title}</h2>
      <div className="mt-5 leading-8 text-muted">{children}</div>
    </article>
  )
}
