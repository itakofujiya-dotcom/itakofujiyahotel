import { ExternalLink, Maximize2, Phone } from 'lucide-react'
import { useCallback, useState } from 'react'
import { PageHero } from '../../components/common/PageHero'
import { FacilityLightbox } from '../../components/facilities/FacilityLightbox'
import { hotelSettings, hotelTelephoneHref } from '../../data/hotel'

const accessMaps = [
  {
    src: '/images/access/car-map.png',
    title: 'お車でお越しの方',
    alt: '潮来富士屋ホテルへ車でお越しの方向けアクセスマップ',
    width: 1536,
    height: 1024,
    objectPosition: 'center',
  },
  {
    src: '/images/access/staition-map.png',
    title: '電車でお越しの方',
    alt: '潮来駅から潮来富士屋ホテルまでのアクセスマップ',
    width: 1536,
    height: 1024,
    objectPosition: 'center',
  },
] as const

const googleMapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(
  `${hotelSettings.hotelNameJa} ${hotelSettings.addressJa}`,
)}&output=embed`

export function AccessPage() {
  const [selectedMapIndex, setSelectedMapIndex] = useState(0)
  const [isMapLightboxOpen, setIsMapLightboxOpen] = useState(false)

  const openMap = (index: number) => {
    setSelectedMapIndex(index)
    setIsMapLightboxOpen(true)
  }
  const closeMap = useCallback(() => setIsMapLightboxOpen(false), [])
  const selectMap = useCallback((index: number) => {
    setSelectedMapIndex(index)
  }, [])

  return (
    <>
      <PageHero
        eyebrow="ACCESS"
        title="アクセス"
        description="水郷のまち・潮来で、皆さまをお待ちしています。"
        image="/images/access/entrance.webp"
      />
      <section className="page-shell py-16 lg:py-24">
        <div className="grid border-y border-line lg:grid-cols-2">
          <article className="py-10 lg:pr-12 lg:py-14">
            <p className="eyebrow">BY CAR</p>
            <h2 className="font-serif text-3xl">お車でお越しの方</h2>
            <p className="mt-5 font-serif text-lg leading-8 text-accent sm:text-xl">
              東関東自動車道「潮来IC」より約10分
            </p>

            <AccessMapButton image={accessMaps[0]} onOpen={() => openMap(0)} />

            <div className="mt-7 border-t border-line pt-6">
              <p className="font-serif text-lg">無料駐車場</p>
              <p className="mt-2 text-sm leading-7 text-muted">
                ホテル向かいの潮来市営駐車場
              </p>
              <ul className="mt-4 flex flex-wrap gap-x-0 gap-y-2 text-sm text-ink">
                {['約20台', '大型車駐車可', '24時間利用可能'].map(
                  (detail, index) => (
                    <li
                      key={detail}
                      className={
                        index === 0
                          ? 'pr-4'
                          : 'border-l border-line px-4 last:pr-0'
                      }
                    >
                      {detail}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </article>

          <article className="border-t border-line py-10 lg:border-l lg:border-t-0 lg:pl-12 lg:py-14">
            <p className="eyebrow">BY TRAIN</p>
            <h2 className="font-serif text-3xl">電車でお越しの方</h2>
            <p className="mt-5 font-serif text-lg leading-8 text-accent sm:text-xl">
              JR鹿島線「潮来駅」よりタクシーで約7分
            </p>

            <AccessMapButton image={accessMaps[1]} onOpen={() => openMap(1)} />

            <p className="mt-7 border-t border-line pt-6 text-sm leading-7 text-muted">
              潮来駅からの送迎も承っております。ご希望の方は事前にお問い合わせください。
            </p>
          </article>
        </div>
      </section>

      <section className="border-y border-line py-16 lg:py-24">
        <div className="page-shell">
          <div className="border border-line bg-surface p-6 sm:p-10 lg:p-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="eyebrow">LOCATION</p>
                <h2 className="font-serif text-3xl">所在地</h2>
                <p className="mt-5 font-serif text-xl">
                  {hotelSettings.hotelNameJa}
                </p>
                <address className="mt-3 not-italic leading-7 text-muted">
                  〒{hotelSettings.postalCode} {hotelSettings.addressJa}
                </address>
                <a
                  href={hotelTelephoneHref}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium"
                >
                  <Phone size={16} aria-hidden="true" />
                  {hotelSettings.telephone}
                </a>
              </div>
              <a
                href={hotelSettings.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-accent px-6 text-sm font-semibold text-accent transition hover:bg-accent hover:text-white"
              >
                Google Mapsでルートを確認
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </div>

            <div className="mt-9 border border-line p-2 sm:p-3">
              <iframe
                title="潮来富士屋ホテル 所在地"
                src={googleMapsEmbedUrl}
                className="h-80 w-full border-0 sm:h-96 lg:h-[28rem]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      <FacilityLightbox
        images={accessMaps}
        selectedIndex={selectedMapIndex}
        isOpen={isMapLightboxOpen}
        onSelectedIndexChange={selectMap}
        onClose={closeMap}
      />
    </>
  )
}

type AccessMapImage = (typeof accessMaps)[number]

function AccessMapButton({
  image,
  onOpen,
}: {
  image: AccessMapImage
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className="group relative mt-8 block aspect-[3/2] w-full cursor-zoom-in overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      onClick={onOpen}
      aria-label={`${image.title}のアクセスマップを拡大`}
    >
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        className="size-full object-contain transition duration-300 group-hover:opacity-90"
      />
      <span className="absolute bottom-3 right-3 grid size-10 place-items-center bg-surface/90 text-ink transition group-hover:bg-accent group-hover:text-white">
        <Maximize2 size={17} aria-hidden="true" />
      </span>
    </button>
  )
}
