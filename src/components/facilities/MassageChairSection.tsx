import { massageChair } from '../../data/facilities'

export function MassageChairSection() {
  return (
    <section
      id={massageChair.id}
      className="border-b border-line py-16 sm:py-20 lg:py-24"
    >
      <div className="page-shell grid gap-10 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-14 xl:gap-20">
        <div>
          <header className="flex items-end justify-between gap-8 border-b border-line pb-6">
            <div>
              <p className="eyebrow">{massageChair.eyebrow}</p>
              <h2 className="font-serif text-3xl font-medium leading-snug sm:text-4xl">
                {massageChair.title}
              </h2>
            </div>
            <p className="font-serif text-4xl text-accent/20 sm:text-5xl">03</p>
          </header>

          <p className="mt-7 font-serif text-xl leading-relaxed text-accent sm:text-2xl">
            {massageChair.catchcopy}
          </p>
          <p className="mt-5 text-sm leading-7 text-muted sm:text-base sm:leading-8">
            {massageChair.description}
          </p>
          <p className="mt-3 text-xs leading-6 text-muted sm:text-[0.8rem]">
            {massageChair.notice}
          </p>

          <dl className="mt-7 grid grid-cols-2 gap-5 border-t border-line pt-5">
            {massageChair.info.map((item) => (
              <div key={item.label}>
                <dt className="text-[10px] font-semibold tracking-[0.2em] text-accent">
                  {item.label}
                </dt>
                <dd className="mt-2 font-serif text-lg">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative lg:pb-10">
          <figure className="overflow-hidden lg:ml-auto lg:w-[90%]">
            <img
              src={massageChair.mainImage.src}
              alt={massageChair.mainImage.alt}
              width={massageChair.mainImage.width}
              height={massageChair.mainImage.height}
              className="aspect-[16/10] w-full object-cover"
              style={{ objectPosition: massageChair.mainImage.objectPosition }}
              loading="lazy"
            />
          </figure>
          <figure className="mt-4 ml-auto w-[68%] overflow-hidden lg:absolute lg:bottom-0 lg:left-0 lg:mt-0 lg:ml-0 lg:w-[42%] lg:border-[8px] lg:border-background">
            <img
              src={massageChair.secondaryImage.src}
              alt={massageChair.secondaryImage.alt}
              width={massageChair.secondaryImage.width}
              height={massageChair.secondaryImage.height}
              className="aspect-[3/2] w-full object-cover"
              style={{
                objectPosition: massageChair.secondaryImage.objectPosition,
              }}
              loading="lazy"
            />
          </figure>
        </div>
      </div>
    </section>
  )
}
