export type FacilityGalleryImage = {
  src: string
  title: string
  alt: string
  width: number
  height: number
  objectPosition: string
}

export const publicBath = {
  id: 'public-bath',
  eyebrow: 'PUBLIC BATH',
  title: '大浴場',
  catchcopy: '旅の疲れを癒す、くつろぎの湯。',
  description: [
    '一日の旅やお仕事の疲れを、ゆったりと癒していただける館内大浴場。広々とした湯船で足を伸ばし、くつろぎのひとときをお過ごしください。',
    '男女それぞれの浴場をご用意しております。',
  ],
  gallery: [
    {
      src: '/images/facilities/fujiya_furoba_01.jpg',
      title: '男性大浴場',
      alt: '潮来富士屋ホテル 男性大浴場',
      width: 2400,
      height: 1600,
      objectPosition: 'center 58%',
    },
    {
      src: '/images/facilities/fujiya_furoba_02.jpg',
      title: '女性大浴場',
      alt: '潮来富士屋ホテル 女性大浴場',
      width: 2400,
      height: 1600,
      objectPosition: 'center 62%',
    },
    {
      src: '/images/facilities/fujiya_furoba_woman.png',
      title: '女性大浴場入口',
      alt: '潮来富士屋ホテル 女性大浴場入口',
      width: 1400,
      height: 933,
      objectPosition: 'center 50%',
    },
    {
      src: '/images/facilities/fujiya_furoba_man.jpg',
      title: '男性大浴場入口',
      alt: '潮来富士屋ホテル 男性大浴場入口',
      width: 1400,
      height: 933,
      objectPosition: 'center 50%',
    },
  ],
} as const

export const hotelLobby = {
  id: 'hotel-lobby',
  eyebrow: 'LOBBY',
  title: 'ホテルロビー',
  catchcopy: 'ご到着からご出発まで、ほっとひと息。',
  description:
    'チェックイン・チェックアウトの際はもちろん、お出かけ前後のひと休みにもご利用いただけるロビースペースです。',
  gallery: [
    {
      src: '/images/facilities/fujiya_lobby_01.jpg',
      title: 'ホテルロビー',
      alt: '潮来富士屋ホテル ロビーから望む庭園',
      width: 2400,
      height: 1600,
      objectPosition: 'center 55%',
    },
    {
      src: '/images/facilities/fujiya_lobby_02.jpg',
      title: 'ホテルロビー',
      alt: '潮来富士屋ホテル ロビー前の庭園と建物',
      width: 2400,
      height: 1600,
      objectPosition: 'center 52%',
    },
    {
      src: '/images/facilities/fujiya_lobby_03.jpg',
      title: 'ホテルロビー',
      alt: '潮来富士屋ホテル ロビー前の庭園風景',
      width: 2400,
      height: 1600,
      objectPosition: 'center 55%',
    },
    {
      src: '/images/facilities/fujiya_lobby_04.jpg',
      title: 'ホテルロビー',
      alt: '庭園を望む潮来富士屋ホテルのロビー',
      width: 2400,
      height: 1600,
      objectPosition: 'center 58%',
    },
  ],
} as const

export const massageChair = {
  id: 'massage-chair',
  eyebrow: 'RELAX',
  title: 'マッサージチェア',
  catchcopy: '旅の疲れを、ゆったりリフレッシュ。',
  description:
    '1階にマッサージチェアを2台ご用意しております。ご宿泊中のリラックスタイムに、どうぞご利用ください。',
  info: [
    { label: 'LOCATION', value: '1階' },
    { label: 'NUMBER', value: '2台' },
  ],
  mainImage: {
    src: '/images/facilities/fujiya_lobby_massagechair_02.jpg',
    alt: 'ロビーの窓辺に設置された2台のマッサージチェア',
    width: 2000,
    height: 1333,
    objectPosition: 'center 55%',
  },
  secondaryImage: {
    src: '/images/facilities/fujiya_lobby_massagechair_01.jpg',
    alt: '館内に設置された2台のマッサージチェア',
    width: 1600,
    height: 1066,
    objectPosition: 'center 58%',
  },
} as const

export const loungeArirang = {
  id: 'lounge-arirang',
  eyebrow: 'LOUNGE',
  title: 'ラウンジ アリラン',
  catchcopy: 'お酒とともに、くつろぎのひとときを。',
  description:
    '館内には、お酒を楽しみながらゆっくりとお過ごしいただけるラウンジ「アリラン」がございます。ご宿泊の夜のひとときに、どうぞお気軽にお立ち寄りください。',
  gallery: [
    {
      src: '/images/facilities/fujiya_lounge_01.jpg',
      title: 'ラウンジ アリラン',
      alt: '潮来富士屋ホテル ラウンジ アリランの客席',
      width: 2400,
      height: 1600,
      objectPosition: 'center 56%',
    },
    {
      src: '/images/facilities/fujiya_lounge_02.jpg',
      title: 'ラウンジ アリラン',
      alt: 'ラウンジ アリランのカラオケスペース',
      width: 2400,
      height: 1600,
      objectPosition: 'center 52%',
    },
    {
      src: '/images/facilities/fujiya_lounge_03.jpg',
      title: 'ラウンジ アリラン',
      alt: '提灯が灯るラウンジ アリランの窓辺',
      width: 2400,
      height: 1600,
      objectPosition: 'center 48%',
    },
    {
      src: '/images/facilities/fujiya_lounge_04.jpg',
      title: 'ラウンジ アリラン',
      alt: 'ラウンジ アリランの入口',
      width: 2400,
      height: 1600,
      objectPosition: 'center 58%',
    },
  ],
  menuImages: [
    {
      src: '/images/facilities/fujiya_lounge_menu_1.png',
      title: 'メニュー 1',
      alt: 'ラウンジ アリラン ドリンクメニュー',
      width: 872,
      height: 1236,
      objectPosition: 'center',
    },
    {
      src: '/images/facilities/fujiya_lounge_menu_2.png',
      title: 'メニュー 2',
      alt: 'ラウンジ アリラン フードメニュー',
      width: 874,
      height: 1240,
      objectPosition: 'center',
    },
  ],
} as const
