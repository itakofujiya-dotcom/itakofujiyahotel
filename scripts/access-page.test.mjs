import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'

const page = await readFile(
  new URL('../src/pages/public/AccessPage.tsx', import.meta.url),
  'utf8',
)
const accessData = await readFile(
  new URL('../src/data/access.ts', import.meta.url),
  'utf8',
)
const lightbox = await readFile(
  new URL('../src/components/facilities/FacilityLightbox.tsx', import.meta.url),
  'utf8',
)

test('keeps car and train in one editorial two-column section, car first', () => {
  assert.match(page, /grid border-y border-line lg:grid-cols-2/)
  assert.match(
    page,
    /BY CAR[\s\S]*お車でお越しの方[\s\S]*BY TRAIN[\s\S]*電車でお越しの方/,
  )
  assert.match(page, /lg:border-l lg:border-t-0/)
  assert.doesNotMatch(page, /shadow-soft/)
})

test('shows the exact confirmed directions and parking details', () => {
  for (const text of [
    '東関東自動車道「潮来IC」より約10分',
    '無料駐車場',
    'ホテル向かいの潮来市営駐車場',
    '約20台',
    '複数台駐車可',
    '24時間利用可能',
    '※大型バスは駐車できません。トラックは駐車可能です。',
    'JR鹿島線「潮来駅」よりタクシーで約7分',
  ]) {
    assert.ok(`${page}\n${accessData}`.includes(text), `${text} is missing`)
  }
  assert.doesNotMatch(`${page}\n${accessData}`, /大型車駐車可/)
  assert.doesNotMatch(`${page}\n${accessData}`, /送迎|お迎え|シャトル/)
  assert.match(page, /\{parkingInformation\.notice\}/)
  assert.match(page, /mt-3 text-xs leading-6 text-muted/)
})

test('uses both supplied uncropped map images and opens the reused lightbox', async () => {
  for (const image of ['car-map.png', 'staition-map.png']) {
    assert.match(page, new RegExp(image.replace('.', '\\.')))
    await access(new URL(`../public/images/access/${image}`, import.meta.url))
  }
  assert.match(page, /aspect-\[3\/2\]/)
  assert.match(page, /object-contain/)
  assert.match(page, /<FacilityLightbox/)
  assert.match(page, /images=\{accessMaps\}/)
  assert.match(page, /setIsMapLightboxOpen\(true\)/)
  assert.match(lightbox, /event\.key === 'Escape'/)
  assert.match(lightbox, /object-contain/)
})

test('renders a real address-derived Google Maps embed and route link', () => {
  assert.match(page, /googleMapsEmbedUrl/)
  assert.match(page, /hotelSettings\.hotelNameJa/)
  assert.match(page, /hotelSettings\.addressJa/)
  assert.match(page, /output=embed/)
  assert.match(page, /<iframe/)
  assert.match(page, /loading="lazy"/)
  assert.match(page, /allowFullScreen/)
  assert.match(page, /href=\{hotelSettings\.mapUrl\}/)
  assert.match(page, /Google Mapsでルートを確認/)
  assert.match(page, /lg:h-\[28rem\]/)
})

test('stacks the transport sections and keeps maps full-width on small screens', () => {
  assert.match(page, /lg:grid-cols-2/)
  assert.match(page, /border-t border-line py-10 lg:border-l lg:border-t-0/)
  assert.match(page, /aspect-\[3\/2\] w-full/)
})
