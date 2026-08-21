import { ButtonLink } from '../common/ButtonLink'
import { BookingSteps } from './BookingSteps'

export function BookingMissing({ current }: { current: 2 | 3 | 4 }) {
  return (
    <section className="page-shell py-14 lg:py-20">
      <BookingSteps current={current} />
      <div className="mx-auto max-w-2xl border border-line bg-surface p-8 text-center shadow-soft sm:p-12">
        <h1 className="font-serif text-3xl">予約情報が見つかりません。</h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          もう一度空室検索からお進みください。
        </p>
        <ButtonLink to="/booking" className="mt-7">
          空室検索に戻る
        </ButtonLink>
      </div>
    </section>
  )
}
