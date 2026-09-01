import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'

const page = await readFile(
  new URL('../src/pages/public/FacilitiesPage.tsx', import.meta.url),
  'utf8',
)
const section = await readFile(
  new URL(
    '../src/components/facilities/PublicBathSection.tsx',
    import.meta.url,
  ),
  'utf8',
)
const lobbySection = await readFile(
  new URL(
    '../src/components/facilities/HotelLobbySection.tsx',
    import.meta.url,
  ),
  'utf8',
)
const massageSection = await readFile(
  new URL(
    '../src/components/facilities/MassageChairSection.tsx',
    import.meta.url,
  ),
  'utf8',
)
const loungeSection = await readFile(
  new URL(
    '../src/components/facilities/LoungeArirangSection.tsx',
    import.meta.url,
  ),
  'utf8',
)
const gallery = await readFile(
  new URL('../src/components/facilities/FacilityGallery.tsx', import.meta.url),
  'utf8',
)
const lightbox = await readFile(
  new URL('../src/components/facilities/FacilityLightbox.tsx', import.meta.url),
  'utf8',
)
const data = await readFile(
  new URL('../src/data/facilities.ts', import.meta.url),
  'utf8',
)
const seo = await readFile(
  new URL('../src/components/common/PublicSeo.tsx', import.meta.url),
  'utf8',
)
const styles = await readFile(
  new URL('../src/styles/global.css', import.meta.url),
  'utf8',
)

test('renders the completed facilities in the approved order', () => {
  assert.match(page, /<PublicBathSection/)
  assert.match(
    page,
    /<PublicBathSection \/>[\s\S]*<HotelLobbySection \/>[\s\S]*<MassageChairSection \/>[\s\S]*<LoungeArirangSection \/>/,
  )
  assert.match(data, /PUBLIC BATH/)
  assert.match(data, /旅の疲れを癒す、くつろぎの湯。/)
  assert.match(data, /LOBBY/)
  assert.match(data, /ご到着からご出発まで、ほっとひと息。/)
  assert.match(data, /RELAX/)
  assert.match(data, /旅の疲れを、ゆったりリフレッシュ。/)
  assert.match(data, /LOUNGE/)
  assert.match(data, /お酒とともに、くつろぎのひとときを。/)
})

test('uses all four supplied bath photographs with the approved labels', async () => {
  for (const image of [
    'fujiya_furoba_01.jpg',
    'fujiya_furoba_02.jpg',
    'fujiya_furoba_woman.png',
    'fujiya_furoba_man.jpg',
  ]) {
    assert.match(data, new RegExp(image.replace('.', '\\.')))
    await access(
      new URL(`../public/images/facilities/${image}`, import.meta.url),
    )
  }

  assert.match(data, /女性大浴場入口/)
  assert.match(data, /男性大浴場入口/)
  assert.match(data, /fujiya_furoba_01\.jpg'[\s\S]*title: '男性大浴場'/)
  assert.match(data, /fujiya_furoba_02\.jpg'[\s\S]*title: '女性大浴場'/)
  assert.match(data, /fujiya_furoba_woman\.png'[\s\S]*title: '女性大浴場入口'/)
  assert.match(data, /fujiya_furoba_man\.jpg'[\s\S]*title: '男性大浴場入口'/)
  assert.match(section, /images=\{publicBath\.gallery\}/)
  assert.match(section, /initialIndex=\{0\}/)
})

test('keeps one responsive viewer with scrollable thumbnails and selected state', () => {
  assert.match(gallery, /useState\(safeInitialIndex\)/)
  assert.match(gallery, /setSelectedIndex\(index\)/)
  assert.match(gallery, /aria-pressed=\{isSelected\}/)
  assert.match(gallery, /overflow-x-auto/)
  assert.match(gallery, /lg:overflow-y-auto/)
  assert.match(gallery, /lg:h-\[clamp\(32\.5rem,62vh,38rem\)\]/)
  assert.match(gallery, /lg:grid-cols-\[minmax\(0,3fr\)_minmax\(15rem,1fr\)\]/)
  assert.match(styles, /\.facility-gallery-scrollbar/)
  assert.doesNotMatch(`${section}\n${lobbySection}\n${gallery}`, /bg-moss/)
  assert.doesNotMatch(
    `${section}\n${lobbySection}\n${gallery}`,
    /bg-\[#e8e3d7\]/,
  )
})

test('reuses the gallery with left thumbnails and lobby image 04 selected', async () => {
  for (const image of [
    'fujiya_lobby_01.jpg',
    'fujiya_lobby_02.jpg',
    'fujiya_lobby_03.jpg',
    'fujiya_lobby_04.jpg',
  ]) {
    assert.match(data, new RegExp(image.replace('.', '\\.')))
    await access(
      new URL(`../public/images/facilities/${image}`, import.meta.url),
    )
  }

  assert.match(lobbySection, /<FacilityGallery/)
  assert.match(lobbySection, /images=\{hotelLobby\.gallery\}/)
  assert.match(lobbySection, /initialIndex=\{3\}/)
  assert.match(lobbySection, /thumbnailPosition="left"/)
  assert.match(lobbySection, /showThumbnailTitles=\{false\}/)
  assert.doesNotMatch(section, /thumbnailPosition=/)
  assert.match(gallery, /thumbnailPosition = 'right'/)
  assert.match(gallery, /thumbnailsOnLeft \? 'lg:order-2' : 'lg:order-1'/)
  assert.match(gallery, /overflow-x-auto/)
  assert.match(gallery, /lg:overflow-y-auto/)
})

test('uses the same gallery height and a reduced-motion-safe fade', () => {
  assert.match(gallery, /lg:h-\[clamp\(32\.5rem,62vh,38rem\)\]/)
  assert.match(gallery, /facility-gallery-image-enter/)
  assert.match(styles, /@keyframes facility-gallery-image-enter/)
  assert.match(styles, /animation: facility-gallery-image-enter 200ms ease-out/)
  assert.match(styles, /prefers-reduced-motion: reduce/)
})

test('uses both massage chair photographs in a shorter non-gallery section', async () => {
  for (const image of [
    'fujiya_lobby_massagechair_01.jpg',
    'fujiya_lobby_massagechair_02.jpg',
  ]) {
    assert.match(data, new RegExp(image.replace('.', '\\.')))
    await access(
      new URL(`../public/images/facilities/${image}`, import.meta.url),
    )
  }

  assert.match(data, /mainImage:[\s\S]*fujiya_lobby_massagechair_02\.jpg/)
  assert.match(data, /secondaryImage:[\s\S]*fujiya_lobby_massagechair_01\.jpg/)
  assert.match(data, /label: 'LOCATION', value: '1階'/)
  assert.match(data, /label: 'NUMBER', value: '2台'/)
  assert.doesNotMatch(massageSection, /FacilityGallery/)
  assert.doesNotMatch(massageSection, /Lightbox/)
  assert.match(massageSection, /lg:grid-cols-/)
  assert.match(massageSection, /lg:absolute/)
  assert.match(massageSection, /lg:w-\[42%\]/)
  assert.doesNotMatch(massageSection, /lg:h-\[clamp/)
})

test('shows the verified massage chair price as subdued supporting copy', () => {
  assert.match(
    data,
    /notice: '※マッサージチェアは有料です。15分500円でご利用いただけます。'/,
  )
  assert.match(massageSection, /\{massageChair\.notice\}/)
  assert.match(massageSection, /mt-3 text-xs leading-6 text-muted/)
  for (const unverified of ['無料', '利用時間', '営業時間'])
    assert.doesNotMatch(`${massageSection}\n${data}`, new RegExp(unverified))
})

test('opens a synchronized lightbox with mouse and keyboard navigation', () => {
  assert.match(gallery, /setIsLightboxOpen\(true\)/)
  assert.match(gallery, /<FacilityLightbox/)
  assert.match(lightbox, /role="dialog"/)
  assert.match(lightbox, /aria-modal="true"/)
  assert.match(lightbox, /event\.key === 'Escape'/)
  assert.match(lightbox, /event\.key === 'ArrowLeft'/)
  assert.match(lightbox, /event\.key === 'ArrowRight'/)
  assert.match(lightbox, /onClick=\{showPrevious\}/)
  assert.match(lightbox, /onClick=\{showNext\}/)
  assert.match(lightbox, /object-contain/)
  assert.match(lightbox, /selectedIndex \+ 1/)
})

test('uses all lounge photographs in the reused right-thumbnail gallery', async () => {
  for (const image of [
    'fujiya_lounge_01.jpg',
    'fujiya_lounge_02.jpg',
    'fujiya_lounge_03.jpg',
    'fujiya_lounge_04.jpg',
  ]) {
    assert.match(data, new RegExp(image.replace('.', '\\.')))
    await access(
      new URL(`../public/images/facilities/${image}`, import.meta.url),
    )
  }

  assert.match(loungeSection, /<FacilityGallery/)
  assert.match(loungeSection, /images=\{loungeArirang\.gallery\}/)
  assert.match(loungeSection, /initialIndex=\{0\}/)
  assert.match(loungeSection, /thumbnailPosition="right"/)
  assert.match(loungeSection, /showThumbnailTitles=\{false\}/)
  assert.match(gallery, /lg:overflow-y-auto/)
  assert.match(gallery, /overflow-x-auto/)
})

test('keeps both uncropped menus outside the photo gallery and reuses lightbox', async () => {
  for (const image of [
    'fujiya_lounge_menu_1.png',
    'fujiya_lounge_menu_2.png',
  ]) {
    assert.match(data, new RegExp(image.replace('.', '\\.')))
    await access(
      new URL(`../public/images/facilities/${image}`, import.meta.url),
    )
  }

  assert.match(loungeSection, /loungeArirang\.menuImages\.map/)
  assert.match(loungeSection, /object-contain/)
  assert.match(loungeSection, /<FacilityLightbox/)
  assert.match(loungeSection, /images=\{loungeArirang\.menuImages\}/)
  assert.equal(loungeSection.match(/<FacilityGallery/g)?.length, 1)
  assert.doesNotMatch(loungeSection, /role="dialog"/)
  assert.doesNotMatch(loungeSection, /ArrowLeft|ArrowRight|event\.key/)
})

test('does not invent lounge hours, pricing, or usage conditions', () => {
  for (const unverified of ['営業時間', '利用時間', '利用条件'])
    assert.doesNotMatch(`${loungeSection}\n${data}`, new RegExp(unverified))
})

test('does not claim unverified bath services and keeps the requested SEO', () => {
  for (const unverified of [
    '温泉',
    '天然温泉',
    '露天風呂',
    'サウナ',
    '利用時間',
    '入浴時間',
    '泉質',
  ])
    assert.doesNotMatch(`${page}\n${section}\n${data}`, new RegExp(unverified))

  assert.match(seo, /館内施設 \| 潮来富士屋ホテル/)
  assert.match(seo, /旅の疲れをゆったりと癒していただける大浴場/)
})
