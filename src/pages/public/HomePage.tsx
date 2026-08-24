import {
  ArrowRight,
  Bath,
  BedDouble,
  Car,
  MapPin,
  TrainFront,
} from 'lucide-react'
import { BookingSearch } from '../../components/booking/BookingSearch'
import { ButtonLink } from '../../components/common/ButtonLink'
import { SectionHeading } from '../../components/common/SectionHeading'
import { RoomCard } from '../../components/rooms/RoomCard'
import { accessInfo, hotelSettings } from '../../data/hotel'
import { roomTypePreviews } from '../../data/rooms'

export function HomePage() {
  return (
    <>
      <section className="relative min-h-[72vh] bg-[#27312d] text-white lg:min-h-[78vh]">
        <img
          src="/images/hotel/hero.webp"
          alt="夜の潮来富士屋ホテル外観"
          className="absolute inset-0 h-full w-full object-cover opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
        <div className="page-shell relative flex min-h-[72vh] items-center py-20 lg:min-h-[78vh]">
          <div className="max-w-xl">
            <p className="mb-5 text-xs tracking-[0.35em] text-white/75">
              ITAKO, IBARAKI
            </p>
            <h1 className="font-serif text-4xl font-medium leading-[1.55] tracking-[0.12em] sm:text-6xl">
              水郷・潮来で、
              <br />
              心ほどけるひとときを。
            </h1>
            <p className="mt-7 max-w-md leading-8 text-white/85">
              街の時間にそっと寄り添う、あたたかな滞在をお届けします。
            </p>
            <ButtonLink to="/rooms" variant="light" className="mt-9">
              客室を見る <ArrowRight size={17} />
            </ButtonLink>
          </div>
        </div>
      </section>
      <section className="relative z-10 -mt-8 pb-20 lg:-mt-12">
        <div className="page-shell">
          <BookingSearch />
        </div>
      </section>
      <section className="page-shell grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <div className="relative">
          <img
            src="/images/hotel/exterior.webp"
            alt="潮来富士屋ホテル外観"
            className="aspect-[4/3] w-full object-cover"
          />
          <div className="absolute -bottom-5 -right-3 bg-moss px-6 py-5 text-white sm:-right-6">
            <p className="font-serif text-lg">水郷のまち、潮来</p>
          </div>
        </div>
        <div className="lg:pl-10">
          <SectionHeading
            eyebrow="WELCOME"
            title="気取らず、ゆっくり。旅の拠点にちょうどいい宿。"
            description="観光やお仕事の一日を終えたあと、ほっと肩の力を抜ける場所。地域に根ざしたホテルとして、皆さまをあたたかくお迎えします。"
          />
          <dl className="mt-8 grid grid-cols-2 gap-5 border-t border-line pt-6 text-sm">
            <div>
              <dt className="text-muted">チェックイン</dt>
              <dd className="mt-1 text-lg">{hotelSettings.checkIn}</dd>
            </div>
            <div>
              <dt className="text-muted">チェックアウト</dt>
              <dd className="mt-1 text-lg">{hotelSettings.checkOut}</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="bg-[#e8e3d7] py-20 lg:py-28">
        <div className="page-shell">
          <SectionHeading
            eyebrow="ROOMS"
            title="旅のかたちに寄り添う客室"
            description="畳でくつろぐ和室と、使いやすい洋室をご用意しています。"
            align="center"
          />
          <div className="mt-12 grid gap-7 md:grid-cols-2">
            {roomTypePreviews.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </div>
      </section>
      <section className="page-shell py-20 lg:py-28">
        <SectionHeading
          eyebrow="STAY"
          title="心地よく過ごすために"
          align="center"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: BedDouble,
              title: '和室・洋室',
              text: '滞在スタイルに合わせて選べる、落ち着いた客室。',
            },
            {
              icon: Bath,
              title: '大浴場',
              text: '一日の疲れをゆっくりと癒やす館内設備。',
            },
            {
              icon: MapPin,
              title: '潮来観光の拠点',
              text: '水郷の風景や周辺観光へ出かけやすい立地。',
            },
          ].map(({ icon: Icon, title, text }) => (
            <article key={title} className="border border-line bg-surface p-8">
              <Icon className="text-accent" size={30} strokeWidth={1.5} />
              <h3 className="mt-6 font-serif text-xl">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">{text}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 text-center">
          <ButtonLink to="/facilities" variant="outline">
            館内施設を見る <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </section>
      <section className="bg-moss py-20 text-white lg:py-24">
        <div className="page-shell grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <SectionHeading
            eyebrow="ACCESS"
            title="潮来のまちへ、ようこそ"
            description="電車でもお車でもお越しいただけます。潮来駅へのお迎えについては、事前にホテルまでお問い合わせください。"
            tone="dark"
          />
          <div className="grid gap-px bg-white/15 sm:grid-cols-2">
            <div className="bg-moss p-7">
              <TrainFront size={28} />
              <h3 className="mt-4 font-medium">電車でお越しの方</h3>
              <p className="mt-3 text-sm leading-7 text-white/75">
                {accessInfo.train}
              </p>
            </div>
            <div className="bg-moss p-7">
              <Car size={28} />
              <h3 className="mt-4 font-medium">お車でお越しの方</h3>
              <p className="mt-3 text-sm leading-7 text-white/75">
                {accessInfo.car}
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="page-shell py-20 lg:py-28">
        <div className="grid overflow-hidden bg-surface shadow-soft lg:grid-cols-2">
          <div
            className="min-h-80 bg-[url('/images/access/entrance.webp')] bg-cover bg-center"
            role="img"
            aria-label="ホテル玄関"
          />
          <div className="flex flex-col justify-center p-9 sm:p-14">
            <SectionHeading
              eyebrow="DISCOVER ITAKO"
              title="水辺の風景と、季節を訪ねる"
              description="水郷ならではの穏やかな景色。潮来を起点に、地域の魅力をゆっくりと巡ってみませんか。"
            />
            <ButtonLink
              to="/sightseeing"
              variant="outline"
              className="mt-8 self-start"
            >
              周辺観光を見る <ArrowRight size={16} />
            </ButtonLink>
          </div>
        </div>
      </section>
      <section className="border-y border-line bg-[#ddd2bd] py-20 text-center">
        <div className="page-shell">
          <p className="eyebrow">RESERVATION</p>
          <h2 className="font-serif text-3xl sm:text-4xl">
            潮来でのご滞在を、ごゆっくり。
          </h2>
          <p className="mt-5 text-muted">
            ご希望の日程と人数から、空室をお探しいただけます。
          </p>
          <ButtonLink to="/booking" className="mt-8">
            空室検索・宿泊予約 <ArrowRight size={17} />
          </ButtonLink>
        </div>
      </section>
    </>
  )
}
