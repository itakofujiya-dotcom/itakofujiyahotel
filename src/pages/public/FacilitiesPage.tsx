import { PageHero } from '../../components/common/PageHero'
import { HotelLobbySection } from '../../components/facilities/HotelLobbySection'
import { LoungeArirangSection } from '../../components/facilities/LoungeArirangSection'
import { MassageChairSection } from '../../components/facilities/MassageChairSection'
import { PublicBathSection } from '../../components/facilities/PublicBathSection'

export function FacilitiesPage() {
  return (
    <>
      <PageHero
        eyebrow="FACILITIES"
        title="館内施設"
        description="館内で過ごす、心ほどけるひととき。"
      />
      <section className="page-shell py-12 sm:py-14 lg:py-16">
        <div className="grid gap-5 border-b border-line pb-12 sm:pb-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16 lg:pb-16">
          <p className="font-serif text-xl leading-8 text-accent sm:text-2xl">
            ご滞在を、より心地よく。
          </p>
          <p className="leading-8 text-muted">
            潮来富士屋ホテルでは、ご滞在をより快適にお過ごしいただける館内施設をご用意しております。旅の疲れを癒し、ゆったりとした時間をお過ごしください。
          </p>
        </div>
      </section>
      <PublicBathSection />
      <HotelLobbySection />
      <MassageChairSection />
      <LoungeArirangSection />
    </>
  )
}
