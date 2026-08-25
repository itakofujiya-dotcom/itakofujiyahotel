import { ArrowUpRight, CalendarDays, MoonStar } from 'lucide-react'
import { PageHero } from '../../components/common/PageHero'
import { SectionHeading } from '../../components/common/SectionHeading'
import {
  featuredEvents,
  sightseeingGroups,
  sightseeingSpots,
  type FeaturedEvent,
  type SightseeingImage as SightseeingImageData,
  type SightseeingSpot,
} from '../../data/sightseeing'

export function SightseeingPage() {
  return (
    <>
      <PageHero
        eyebrow="SIGHTSEEING"
        title="潮来・周辺観光"
        description="水郷の風景と歴史をめぐる、潮来の旅。季節の祭りや水辺の風景、歴史ある名所など、潮来富士屋ホテルを拠点に楽しめる周辺スポットをご紹介します。"
      />

      <div>
        <section className="page-shell py-20 lg:py-28">
          <SectionHeading
            eyebrow="FEATURED EVENT"
            title="今、潮来を訪れる理由"
            description="水辺のまちが大きな祝祭に包まれる、2026年。二つの特別な催しをご案内します。"
          />
          <div className="mt-12 space-y-12 lg:mt-16 lg:space-y-20">
            {featuredEvents.map((event, index) => (
              <FeaturedEventArticle
                event={event}
                reverse={index % 2 === 1}
                key={event.id}
              />
            ))}
          </div>
        </section>

        {sightseeingGroups.map((group, groupIndex) => {
          const spots = group.spotIds.map((id) => {
            const spot = sightseeingSpots.find((entry) => entry.id === id)
            if (!spot) throw new Error(`Missing sightseeing spot: ${id}`)
            return spot
          })
          return (
            <section
              className={
                groupIndex % 2 === 0
                  ? 'border-y border-line bg-[#e8e3d7] py-20 lg:py-28'
                  : 'py-20 lg:py-28'
              }
              key={group.eyebrow}
            >
              <div className="page-shell">
                <SectionHeading
                  eyebrow={group.eyebrow}
                  title={group.title}
                  description={group.description}
                />
                <div className="mt-12 space-y-10 lg:mt-16 lg:space-y-16">
                  {spots.map((spot, index) => (
                    <SpotArticle
                      spot={spot}
                      reverse={(groupIndex + index) % 2 === 1}
                      key={spot.id}
                    />
                  ))}
                </div>
              </div>
            </section>
          )
        })}

        <section className="bg-moss py-16 text-white lg:py-20">
          <div className="page-shell grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
            <MoonStar size={40} strokeWidth={1.25} aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] text-white/60">
                PLAN YOUR TRIP
              </p>
              <h2 className="mt-3 font-serif text-2xl sm:text-3xl">
                旅の前に、最新の公式情報をご確認ください。
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">
                季節の催しや交通情報は変更になる場合があります。各スポットの公式サイトで最新情報をご確認のうえ、お出かけください。
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

function FeaturedEventArticle({
  event,
  reverse,
}: {
  event: FeaturedEvent
  reverse: boolean
}) {
  return (
    <article className="grid overflow-hidden border border-line bg-surface shadow-soft lg:grid-cols-2">
      <SightseeingImage
        image={event.image}
        className={reverse ? 'lg:order-2' : undefined}
        featured
      />
      <div
        className={`flex flex-col justify-center p-7 sm:p-10 lg:p-12 ${reverse ? 'lg:order-1' : ''}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold tracking-[0.2em] text-accent">
            {event.category}
          </p>
          <span className="bg-accent px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-white">
            {event.badge}
          </span>
        </div>
        <h2 className="mt-6 font-serif text-3xl font-medium leading-snug sm:text-4xl">
          {event.title}
        </h2>
        <p className="mt-4 font-serif text-lg text-accent">{event.catchcopy}</p>
        <div className="mt-7 flex items-center gap-3 border-y border-line py-5">
          <CalendarDays size={22} strokeWidth={1.5} className="text-accent" />
          <p className="font-semibold">{event.date}</p>
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          {event.details.map((detail) => (
            <div key={detail.label}>
              <dt className="text-xs text-muted">{detail.label}</dt>
              <dd className="mt-1 font-semibold leading-6">{detail.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-7 space-y-4 text-sm leading-7 text-muted">
          {event.description.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {event.note && (
          <p className="mt-5 border-l-2 border-accent pl-4 text-xs leading-6 text-muted">
            {event.note}
          </p>
        )}
        <ExternalLink href={event.link.url}>{event.link.label}</ExternalLink>
      </div>
    </article>
  )
}

function SpotArticle({
  spot,
  reverse,
}: {
  spot: SightseeingSpot
  reverse: boolean
}) {
  return (
    <article className="grid overflow-hidden border border-line bg-surface lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <SightseeingImage
        image={spot.image}
        className={reverse ? 'lg:order-2' : undefined}
      />
      <div
        className={`flex flex-col justify-center p-7 sm:p-10 lg:p-12 ${reverse ? 'lg:order-1' : ''}`}
      >
        <p className="text-xs font-semibold tracking-[0.2em] text-accent">
          {spot.category}
        </p>
        <h3 className="mt-5 font-serif text-3xl font-medium">{spot.title}</h3>
        <p className="mt-3 font-serif text-lg text-accent">{spot.catchcopy}</p>
        <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
          {spot.description.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {spot.info && (
          <dl className="mt-7 grid gap-px bg-line sm:grid-cols-2">
            {spot.info.map((item) => (
              <div className="bg-background p-4" key={item.label}>
                <dt className="text-xs text-muted">{item.label}</dt>
                <dd className="mt-1 text-sm font-semibold">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <ExternalLink href={spot.link.url}>{spot.link.label}</ExternalLink>
      </div>
    </article>
  )
}

function SightseeingImage({
  image,
  className = '',
  featured = false,
}: {
  image: SightseeingImageData
  className?: string
  featured?: boolean
}) {
  return (
    <figure
      className={`relative min-h-72 overflow-hidden bg-moss sm:min-h-96 lg:min-h-full ${className}`}
    >
      <img
        src={image.src}
        alt={image.alt}
        className="absolute inset-0 size-full object-cover transition duration-700 hover:scale-[1.02]"
        loading={featured ? 'eager' : 'lazy'}
      />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/75 to-transparent" />
      <figcaption className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-x-1 px-5 py-4 text-[10px] leading-5 text-white/85 sm:px-6">
        <a
          className="underline decoration-white/40 underline-offset-4 hover:text-white"
          href={image.creditUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {image.credit}
        </a>
        {image.license && image.licenseUrl && (
          <>
            <span aria-hidden="true">·</span>
            <a
              className="underline decoration-white/40 underline-offset-4 hover:text-white"
              href={image.licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {image.license}
            </a>
          </>
        )}
      </figcaption>
    </figure>
  )
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 self-start border border-ink px-6 text-sm font-semibold tracking-wide transition hover:bg-ink hover:text-white"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={16} aria-hidden="true" />
    </a>
  )
}
