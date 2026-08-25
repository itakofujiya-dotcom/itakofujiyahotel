import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect } from 'react'
import type { FacilityGalleryImage } from '../../data/facilities'

type Props = {
  images: readonly FacilityGalleryImage[]
  selectedIndex: number
  isOpen: boolean
  onSelectedIndexChange: (index: number) => void
  onClose: () => void
}

export function FacilityLightbox({
  images,
  selectedIndex,
  isOpen,
  onSelectedIndexChange,
  onClose,
}: Props) {
  const selectedImage = images[selectedIndex]

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft')
        onSelectedIndexChange(
          (selectedIndex - 1 + images.length) % images.length,
        )
      if (event.key === 'ArrowRight')
        onSelectedIndexChange((selectedIndex + 1) % images.length)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [images.length, isOpen, onClose, onSelectedIndexChange, selectedIndex])

  if (!isOpen || !selectedImage) return null

  const showPrevious = () =>
    onSelectedIndexChange((selectedIndex - 1 + images.length) % images.length)
  const showNext = () =>
    onSelectedIndexChange((selectedIndex + 1) % images.length)

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4 text-white sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${selectedImage.title} 写真表示`}
      onClick={onClose}
    >
      <div
        className="relative flex size-full max-w-7xl flex-col items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-0 top-0 z-10 grid size-11 place-items-center bg-black/35 transition hover:bg-black/60"
          onClick={onClose}
          aria-label="閉じる"
          autoFocus
        >
          <X size={22} aria-hidden="true" />
        </button>

        <img
          src={selectedImage.src}
          alt={selectedImage.alt}
          width={selectedImage.width}
          height={selectedImage.height}
          className="max-h-[78vh] w-full object-contain"
        />

        <button
          type="button"
          className="absolute left-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center bg-black/35 transition hover:bg-black/60 sm:left-2"
          onClick={showPrevious}
          aria-label="前の写真"
        >
          <ChevronLeft size={26} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="absolute right-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center bg-black/35 transition hover:bg-black/60 sm:right-2"
          onClick={showNext}
          aria-label="次の写真"
        >
          <ChevronRight size={26} aria-hidden="true" />
        </button>

        <div className="mt-4 flex w-full max-w-3xl items-center justify-between gap-6 text-xs">
          <p className="font-semibold">{selectedImage.title}</p>
          <p className="text-white/70">
            {selectedIndex + 1} / {images.length}
          </p>
        </div>
      </div>
    </div>
  )
}
