type Props = {
  eyebrow: string
  title: string
  description?: string
  align?: 'left' | 'center'
  tone?: 'default' | 'dark'
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  tone = 'default',
}: Props) {
  return (
    <div
      className={
        align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'
      }
    >
      <p className={tone === 'dark' ? 'eyebrow text-white/75' : 'eyebrow'}>
        {eyebrow}
      </p>
      <h2 className="font-serif text-3xl font-medium leading-snug sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p
          className={
            tone === 'dark'
              ? 'mt-5 leading-8 text-white/85'
              : 'mt-5 leading-8 text-muted'
          }
        >
          {description}
        </p>
      )}
    </div>
  )
}
