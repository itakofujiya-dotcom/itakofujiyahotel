import { restaurant } from '../../data/facilities'
import { FacilityGallery } from './FacilityGallery'

export function RestaurantSection() {
  return (
    <section
      id={restaurant.id}
      className="border-b border-line py-16 sm:py-20 lg:py-24"
    >
      <div className="page-shell">
        <header className="flex items-end justify-between gap-8 border-b border-line pb-6">
          <div>
            <p className="eyebrow">{restaurant.eyebrow}</p>
            <h2 className="font-serif text-3xl font-medium leading-snug sm:text-4xl">
              {restaurant.title}
            </h2>
          </div>
          <p className="font-serif text-4xl text-accent/20 sm:text-5xl">03</p>
        </header>

        <div className="mt-8">
          <FacilityGallery
            images={restaurant.gallery}
            initialIndex={0}
            enableLightbox
            ariaLabel="レストランフォトギャラリー"
            showThumbnailTitles={false}
          />
        </div>

        <div className="mt-8 grid gap-5 border-t border-line pt-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          <p className="font-serif text-xl leading-relaxed text-accent sm:text-2xl">
            {restaurant.catchcopy}
          </p>
          <div className="space-y-3 text-sm leading-7 text-muted sm:text-base sm:leading-8">
            {restaurant.description.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
