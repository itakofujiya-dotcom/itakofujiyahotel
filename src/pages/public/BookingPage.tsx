import { BookingSearch } from '../../components/booking/BookingSearch'
import { PageHero } from '../../components/common/PageHero'

export function BookingPage() {
  return (
    <>
      <PageHero
        eyebrow="BOOKING"
        title="空室検索・宿泊予約"
        description="ご希望の宿泊日と人数を入力してください。"
      />
      <section className="page-shell py-14 lg:py-20">
        <BookingSearch />
        <div className="mt-8 border border-line bg-surface p-7">
          <h2 className="font-serif text-xl">予約受付機能は準備中です</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            現在は検索条件の入力と検証までご利用いただけます。空室・料金の表示と予約確定は、ホテルの料金・予約運用方針が確定後に接続します。
          </p>
        </div>
      </section>
    </>
  )
}
