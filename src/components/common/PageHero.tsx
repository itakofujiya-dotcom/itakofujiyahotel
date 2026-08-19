type Props = {
  eyebrow: string
  title: string
  description: string
  image?: string
}

export function PageHero({ eyebrow, title, description, image }: Props) {
  return (
    <section className="relative overflow-hidden bg-moss py-20 text-white sm:py-28">
      {image && (
        <>
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-moss via-moss/85 to-moss/30" />
        </>
      )}
      <div className="page-shell relative">
        <p className="mb-4 text-xs font-semibold tracking-[0.28em] text-white/60">
          {eyebrow}
        </p>
        <h1 className="page-title max-w-3xl">{title}</h1>
        <p className="mt-6 max-w-2xl leading-8 text-white/75">{description}</p>
      </div>
    </section>
  )
}
