import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'

const page = await readFile(
  new URL('../src/pages/public/SightseeingPage.tsx', import.meta.url),
  'utf8',
)
const data = await readFile(
  new URL('../src/data/sightseeing.ts', import.meta.url),
  'utf8',
)
const seo = await readFile(
  new URL('../src/components/common/PublicSeo.tsx', import.meta.url),
  'utf8',
)

test('keeps limited events separate from permanent sightseeing spots', () => {
  assert.match(data, /export const featuredEvents/)
  assert.match(data, /export const sightseeingSpots/)
  assert.match(data, /第48回 水郷潮来花火大会/)
  assert.match(data, /鹿島神宮 式年大祭 御船祭/)
  assert.match(data, /2026年10月31日（土）/)
  assert.match(data, /2026年9月1日（火）〜9月3日（木）/)
  assert.match(data, /9月2日 13:30頃 御発船/)
})

test('renders all requested sightseeing destinations, photographs, and links', async () => {
  for (const title of [
    '水郷潮来あやめ園',
    '十二橋めぐり',
    '鹿島神宮',
    '長勝寺',
    '道の駅いたこ',
    '佐原の町並み',
  ])
    assert.match(data, new RegExp(title))

  assert.match(page, /target="_blank"/)
  assert.match(page, /rel="noopener noreferrer"/)
  assert.match(page, /<img/)
  assert.match(page, /loading=\{featured \? 'eager' : 'lazy'\}/)
  assert.doesNotMatch(page, /写真は利用条件確認中/)

  for (const image of [
    'itako-fireworks-2026.jpg',
    'mifune-matsuri-2014.jpg',
    'ayame-park.jpg',
    'junikyo-boat.jpg',
    'kashima-jingu.jpg',
    'choshoji.jpg',
    'michinoeki-itako.jpg',
    'sawara.jpg',
  ]) {
    assert.match(data, new RegExp(image.replace('.', '\\.')))
    await access(
      new URL(`../public/images/sightseeing/${image}`, import.meta.url),
    )
  }

  assert.match(data, /CC BY 4\.0/)
  assert.match(data, /CC BY-SA 3\.0/)
  assert.match(data, /Wikimedia Commons/)
})

test('uses editorial responsive layouts and route-specific SEO', () => {
  assert.match(page, /lg:grid-cols-2/)
  assert.match(page, /lg:order-2/)
  assert.match(page, /sm:grid-cols-2/)
  assert.match(seo, /潮来・周辺観光 \| 潮来富士屋ホテル/)
  assert.match(seo, /水郷潮来花火大会、鹿島神宮御船祭/)
})
