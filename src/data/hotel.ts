import type { Amenity, HotelSettings } from '../types/domain'

export const hotelSettings: HotelSettings = {
  hotelNameJa: '潮来富士屋ホテル',
  hotelNameEn: 'ITAKO FUJIYA HOTEL',
  postalCode: '311-2424',
  addressJa: '茨城県潮来市潮来102',
  telephone: '0299-62-2000',
  fax: '0299-63-0801',
  email: null,
  checkIn: '15:00',
  checkOut: '10:00',
  frontDeskOpen: '15:00',
  frontDeskClose: '22:00',
  mapUrl: 'https://goo.gl/maps/GwPmVZCzfNbi5CRZ9',
}

export const accessInfo = {
  train: 'JR鹿島線「潮来駅」よりタクシーで約7分',
  pickup: '潮来駅まではお車でお迎えにあがります。',
  pickupNotice: 'ご利用条件はホテルへお問い合わせください。',
  car: '東関東自動車道 潮来ICから約10分',
} as const

export const amenities: Amenity[] = [
  ['wifi', '無料Wi-Fi', 'facility', true],
  ['air-conditioner', 'エアコン', 'facility', true],
  ['tv', 'テレビ', 'facility', true],
  ['refrigerator', '冷蔵庫', 'facility', true],
  ['kettle', '電気ポット', 'facility', true],
  ['hair-dryer', 'ドライヤー', 'facility', true],
  ['bathroom', 'バス', 'facility', true],
  ['toilet', 'トイレ', 'facility', true],
  ['non-smoking', '禁煙', 'facility', true],
  ['toothbrush', '歯ブラシ', 'toiletry', true],
  ['towel', 'タオル', 'toiletry', true],
  ['shampoo', 'シャンプー', 'toiletry', true],
  ['conditioner', 'コンディショナー', 'toiletry', true],
  ['body-soap', 'ボディソープ', 'toiletry', true],
  ['slippers', 'スリッパ', 'toiletry', true],
  ['coffee', 'コーヒー', 'toiletry', false],
  ['tea', 'お茶', 'toiletry', false],
].map(([id, labelJa, category, provided]) => ({
  id,
  labelJa,
  category,
  provided,
})) as Amenity[]
