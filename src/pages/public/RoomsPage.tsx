import { Check, Minus } from 'lucide-react'
import { PageHero } from '../../components/common/PageHero'
import { RoomCard } from '../../components/rooms/RoomCard'
import { amenities } from '../../data/hotel'
import { roomTypePreviews } from '../../data/rooms'

export function RoomsPage() {
  return (
    <>
      <PageHero
        eyebrow="ROOMS"
        title="客室"
        description="旅の人数や過ごし方に合わせて、和室と洋室からお選びいただけます。"
        image="/images/rooms/japanese-room.webp"
      />
      <section className="page-shell py-16 lg:py-24">
        <div className="grid gap-8 md:grid-cols-2">
          {roomTypePreviews.map((room) => (
            <RoomCard key={room.id} room={room} headingLevel={2} />
          ))}
        </div>
        <div className="mt-20">
          <p className="eyebrow">AMENITIES</p>
          <h2 className="font-serif text-3xl">客室設備・アメニティ</h2>
          <div className="mt-8 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {amenities.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-surface px-5 py-4 text-sm"
              >
                {item.provided ? (
                  <Check size={17} className="text-moss" />
                ) : (
                  <Minus size={17} className="text-muted" />
                )}
                <span className={item.provided ? '' : 'text-muted'}>
                  {item.labelJa}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-8 border-l-2 border-accent pl-5 text-sm leading-7 text-muted">
          客室の面積・ベッド規格・販売する客室タイプは現在確認中です。確定後に情報を更新します。
        </p>
      </section>
    </>
  )
}
