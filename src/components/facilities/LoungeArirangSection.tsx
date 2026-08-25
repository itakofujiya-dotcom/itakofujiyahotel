import { useState } from 'react'
import { loungeArirang } from '../../data/facilities'
import { FacilityGallery } from './FacilityGallery'
import { FacilityLightbox } from './FacilityLightbox'

export function LoungeArirangSection() {
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0)
  const [isMenuLightboxOpen, setIsMenuLightboxOpen] = useState(false)

  const openMenu = (index: number) => {
    setSelectedMenuIndex(index)
    setIsMenuLightboxOpen(true)
  }

  return (
    <section id={loungeArirang.id} className="py-16 sm:py-20 lg:py-24">
      <div className="page-shell">
        <header className="flex items-end justify-between gap-8 border-b border-line pb-6">
          <div>
            <p className="eyebrow">{loungeArirang.eyebrow}</p>
            <h2 className="font-serif text-3xl font-medium leading-snug sm:text-4xl">
              {loungeArirang.title}
            </h2>
          </div>
          <p className="font-serif text-4xl text-accent/20 sm:text-5xl">04</p>
        </header>

        <div className="grid gap-5 py-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          <p className="font-serif text-xl leading-relaxed text-accent sm:text-2xl">
            {loungeArirang.catchcopy}
          </p>
          <p className="text-sm leading-7 text-muted sm:text-base sm:leading-8">
            {loungeArirang.description}
          </p>
        </div>

        <FacilityGallery
          images={loungeArirang.gallery}
          initialIndex={0}
          enableLightbox
          ariaLabel="ラウンジ アリラン フォトギャラリー"
          thumbnailPosition="right"
          showThumbnailTitles={false}
        />

        <div className="mt-20 border-t border-line pt-12 lg:mt-28 lg:pt-16">
          <div className="text-center">
            <p className="eyebrow">MENU</p>
            <h3 className="font-serif text-3xl font-medium">メニュー</h3>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-8 sm:grid-cols-2 lg:mt-12 lg:gap-12">
            {loungeArirang.menuImages.map((menu, index) => (
              <figure key={menu.src}>
                <button
                  type="button"
                  className="group block w-full cursor-zoom-in"
                  onClick={() => openMenu(index)}
                  aria-label={`${menu.title}を拡大表示`}
                >
                  <img
                    src={menu.src}
                    alt={menu.alt}
                    width={menu.width}
                    height={menu.height}
                    className="h-80 w-full object-contain transition-opacity group-hover:opacity-90 sm:h-[34rem]"
                    loading="lazy"
                  />
                </button>
                <figcaption className="mt-3 border-t border-line pt-3 text-center text-[11px] font-semibold tracking-[0.16em] text-accent">
                  {menu.title}
                </figcaption>
              </figure>
            ))}
          </div>

          <p className="mt-8 text-center text-xs leading-6 text-muted">
            クリックすると拡大してご覧いただけます。
          </p>
        </div>
      </div>

      <FacilityLightbox
        images={loungeArirang.menuImages}
        selectedIndex={selectedMenuIndex}
        isOpen={isMenuLightboxOpen}
        onSelectedIndexChange={setSelectedMenuIndex}
        onClose={() => setIsMenuLightboxOpen(false)}
      />
    </section>
  )
}
