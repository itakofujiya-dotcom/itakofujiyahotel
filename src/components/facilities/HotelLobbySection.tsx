import { hotelLobby } from '../../data/facilities'
import { FacilityGallery } from './FacilityGallery'

export function HotelLobbySection() {
  return (
    <section
      id={hotelLobby.id}
      className="border-b border-line py-16 sm:py-20 lg:py-24"
    >
      <div className="page-shell">
        <header className="flex items-end justify-between gap-8 border-b border-line pb-6">
          <div>
            <p className="eyebrow">{hotelLobby.eyebrow}</p>
            <h2 className="font-serif text-3xl font-medium leading-snug sm:text-4xl">
              {hotelLobby.title}
            </h2>
          </div>
          <p className="font-serif text-4xl text-accent/20 sm:text-5xl">02</p>
        </header>

        <div className="mt-8">
          <FacilityGallery
            images={hotelLobby.gallery}
            initialIndex={3}
            enableLightbox
            ariaLabel="ホテルロビーフォトギャラリー"
            thumbnailPosition="left"
            showThumbnailTitles={false}
          />
        </div>

        <div className="mt-8 grid gap-5 border-t border-line pt-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          <p className="font-serif text-xl leading-relaxed text-accent sm:text-2xl">
            {hotelLobby.catchcopy}
          </p>
          <p className="text-sm leading-7 text-muted sm:text-base sm:leading-8">
            {hotelLobby.description}
          </p>
        </div>
      </div>
    </section>
  )
}
