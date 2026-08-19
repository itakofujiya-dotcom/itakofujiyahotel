export function AdminPageHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold tracking-[.18em] text-accent">
        ADMIN
      </p>
      <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-muted">{description}</p>
    </div>
  )
}
