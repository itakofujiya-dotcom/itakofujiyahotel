import { Maximize2 } from 'lucide-react'
import { useState } from 'react'
import type { FacilityGalleryImage } from '../../data/facilities'
import { FacilityLightbox } from './FacilityLightbox'

type Props = {
  images: readonly FacilityGalleryImage[]
  initialIndex?: number
  enableLightbox?: boolean
  ariaLabel: string
  thumbnailPosition?: 'left' | 'right'
  showThumbnailTitles?: boolean
}

export function FacilityGallery({
  images,
  initialIndex = 0,
  enableLightbox = true,
  ariaLabel,
  thumbnailPosition = 'right',
  showThumbnailTitles = true,
}: Props) {
  const safeInitialIndex = Math.min(
    Math.max(initialIndex, 0),
    images.length - 1,
  )
  const [selectedIndex, setSelectedIndex] = useState(safeInitialIndex)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const selectedImage = images[selectedIndex]
  const thumbnailsOnLeft = thumbnailPosition === 'left'

  if (!selectedImage) return null

  return (
    <>
      <div
        className={`grid gap-4 lg:h-[clamp(32.5rem,62vh,38rem)] lg:gap-5 ${
          thumbnailsOnLeft
            ? 'lg:grid-cols-[minmax(15rem,1fr)_minmax(0,3fr)]'
            : 'lg:grid-cols-[minmax(0,3fr)_minmax(15rem,1fr)]'
        }`}
        aria-label={ariaLabel}
      >
        <figure
          className={`flex min-h-0 flex-col ${
            thumbnailsOnLeft ? 'lg:order-2' : 'lg:order-1'
          }`}
        >
          <button
            type="button"
            className="group relative aspect-[4/3] min-h-56 w-full cursor-zoom-in overflow-hidden text-left sm:aspect-video lg:aspect-auto lg:min-h-0 lg:flex-1"
            onClick={() => enableLightbox && setIsLightboxOpen(true)}
            aria-label={`${selectedImage.title}を拡大表示`}
          >
            <img
              key={selectedImage.src}
              src={selectedImage.src}
              alt={selectedImage.alt}
              width={selectedImage.width}
              height={selectedImage.height}
              className="facility-gallery-image-enter absolute inset-0 size-full object-cover"
              style={{ objectPosition: selectedImage.objectPosition }}
              loading="eager"
              fetchPriority="high"
            />
            {enableLightbox && (
              <span className="absolute bottom-4 right-4 grid size-9 place-items-center bg-black/45 text-white backdrop-blur-sm transition group-hover:bg-black/60">
                <Maximize2 size={16} aria-hidden="true" />
              </span>
            )}
          </button>
          <figcaption className="flex shrink-0 items-center justify-between gap-4 border-b border-line py-3 text-xs">
            <span className="font-semibold text-accent">
              {selectedImage.title}
            </span>
            <span className="text-muted">
              {selectedIndex + 1} / {images.length}
            </span>
          </figcaption>
        </figure>

        <div
          className={`facility-gallery-scrollbar flex gap-3 overflow-x-auto pb-2 lg:block lg:h-full lg:space-y-3 lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0 ${
            thumbnailsOnLeft ? 'lg:order-1 lg:pl-2' : 'lg:order-2 lg:pr-2'
          }`}
          aria-label="写真を選択"
        >
          {images.map((image, index) => {
            const isSelected = index === selectedIndex
            return (
              <button
                type="button"
                className={`w-36 shrink-0 border-b pb-2 text-left transition lg:w-full ${
                  isSelected
                    ? 'border-accent opacity-100'
                    : 'border-line opacity-65 hover:opacity-100'
                }`}
                onClick={() => setSelectedIndex(index)}
                aria-pressed={isSelected}
                aria-label={`${image.title} ${index + 1}`}
                key={image.src}
              >
                <img
                  src={image.src}
                  alt=""
                  width={image.width}
                  height={image.height}
                  className="h-24 w-full object-cover lg:h-28"
                  style={{ objectPosition: image.objectPosition }}
                  loading="lazy"
                />
                {showThumbnailTitles && (
                  <span className="mt-2 block truncate text-[11px] font-semibold text-ink">
                    {image.title}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <FacilityLightbox
        images={images}
        selectedIndex={selectedIndex}
        isOpen={isLightboxOpen}
        onSelectedIndexChange={setSelectedIndex}
        onClose={() => setIsLightboxOpen(false)}
      />
    </>
  )
}
