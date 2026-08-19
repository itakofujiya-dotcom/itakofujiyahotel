import { PageHero } from '../../components/common/PageHero'

export function SightseeingPage() {
  return (
    <>
      <PageHero
        eyebrow="SIGHTSEEING"
        title="周辺観光"
        description="水辺の景色や季節の風情に出会える、潮来の旅へ。"
        image="/images/hotel/exterior.webp"
      />
      <section className="page-shell py-20">
        <div className="mx-auto max-w-2xl border border-line bg-surface p-9 text-center sm:p-12">
          <p className="eyebrow">COMING SOON</p>
          <h2 className="font-serif text-2xl">観光情報を準備しています</h2>
          <p className="mt-5 leading-8 text-muted">
            施設名や所要時間など、正確な情報を確認したうえで掲載します。
          </p>
        </div>
      </section>
    </>
  )
}
