import { PageHero } from '../../components/common/PageHero'

const facilities = [
  {
    title: '大浴場',
    image: '/images/facilities/bath.webp',
    text: '一日の疲れを癒やし、ゆっくりとお過ごしいただけます。',
  },
  {
    title: 'ロビー',
    image: '/images/facilities/lobby.jpg',
    text: 'ご到着からご出発まで、皆さまをあたたかくお迎えします。',
  },
  {
    title: '館内スペース',
    image: '/images/facilities/restaurant.jpg',
    text: '館内サービスの詳細は、内容の確認後に順次ご案内します。',
  },
]
export function FacilitiesPage() {
  return (
    <>
      <PageHero
        eyebrow="FACILITIES"
        title="館内施設"
        description="気兼ねなくお過ごしいただける、落ち着いた館内です。"
        image="/images/facilities/lobby.jpg"
      />
      <section className="page-shell py-16 lg:py-24">
        <div className="space-y-14">
          {facilities.map((item, index) => (
            <article
              key={item.title}
              className="grid items-center gap-8 lg:grid-cols-2"
            >
              <img
                src={item.image}
                alt={item.title}
                className={`aspect-[16/10] w-full object-cover ${index % 2 ? 'lg:order-2' : ''}`}
              />
              <div className="px-2 lg:px-12">
                <p className="text-xs tracking-[.2em] text-accent">
                  0{index + 1}
                </p>
                <h2 className="mt-3 font-serif text-3xl">{item.title}</h2>
                <p className="mt-5 leading-8 text-muted">{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
