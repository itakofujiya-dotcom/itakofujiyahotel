import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

type Props = {
  to: string
  children: ReactNode
  variant?: 'solid' | 'outline' | 'light'
  className?: string
}

export function ButtonLink({
  to,
  children,
  variant = 'solid',
  className,
}: Props) {
  return (
    <Link
      className={clsx(
        'inline-flex min-h-12 items-center justify-center gap-2 px-6 text-sm font-semibold tracking-wide transition',
        variant === 'solid' && 'bg-accent text-white hover:bg-accent-hover',
        variant === 'outline' &&
          'border border-ink text-ink hover:bg-ink hover:text-white',
        variant === 'light' && 'bg-surface text-ink hover:bg-background',
        className,
      )}
      to={to}
    >
      {children}
    </Link>
  )
}
