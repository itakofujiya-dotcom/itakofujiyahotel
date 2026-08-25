export type SightseeingLink = { label: string; url: string; source: string }

export type SightseeingImage = {
  src: string
  alt: string
  credit: string
  creditUrl: string
  license?: string
  licenseUrl?: string
}

export type FeaturedEvent = {
  id: string
  category: string
  badge: string
  title: string
  catchcopy: string
  date: string
  details: { label: string; value: string }[]
  description: string[]
  note?: string
  image: SightseeingImage
  link: SightseeingLink
}

export type SightseeingSpot = {
  id: string
  category: string
  title: string
  catchcopy: string
  description: string[]
  info?: { label: string; value: string }[]
  image: SightseeingImage
  link: SightseeingLink
}

export const featuredEvents: FeaturedEvent[] = [
  {
    id: 'itako-fireworks-2026',
    category: 'SEASONAL EVENT / 2026',
    badge: '2026.10.31 開催',
    title: '第48回 水郷潮来花火大会',
    catchcopy: '小さなまちが、いちばん輝く夜。',
    date: '2026年10月31日（土）',
    details: [
      { label: '時間', value: '18:30 打上開始' },
      { label: '会場', value: '北利根川特設会場（水郷北斎公園）' },
      { label: '荒天時', value: '11月1日（日）に延期予定' },
    ],
    description: [
      '北利根川の水辺を舞台に開催される、潮来の秋を代表する花火大会。スターマインや水中スターマインなど、水郷潮来ならではの水辺の花火を間近で楽しむことができます。',
      '夜空だけでなく水面にも光が映り込む、潮来ならではの秋の風景をお楽しみください。',
    ],
    image: {
      src: '/images/sightseeing/itako-fireworks-2026.jpg',
      alt: '北利根川の水面を彩る水郷潮来花火大会の打上花火',
      credit: '写真：潮来市公式ホームページ',
      creditUrl:
        'https://www.city.itako.lg.jp/kankou/kankou-info/page009024.html',
    },
    link: {
      label: '公式情報を見る',
      url: 'https://www.city.itako.lg.jp/kankou/kankou-info/page009024.html',
      source: '潮来市公式ホームページ',
    },
  },
  {
    id: 'mifune-matsuri-2026',
    category: 'SPECIAL EVENT / 12年に一度',
    badge: '2026 SPECIAL EVENT',
    title: '鹿島神宮 式年大祭 御船祭',
    catchcopy: '十二年に一度、水郷を進む壮麗な船団。',
    date: '2026年9月1日（火）〜9月3日（木）',
    details: [
      { label: 'メイン', value: '9月2日（水） 水上渡御' },
      { label: '潮来河岸', value: '9月2日 13:30頃 御発船' },
    ],
    description: [
      '鹿島神宮最大の祭典のひとつ「式年大祭御船祭」。午年にあたる12年に一度斎行される特別な祭典で、御神輿を奉戴した御座船と多数の供奉船が水郷を進みます。',
      '9月2日の水上渡御では、大船津から香取市加藤洲へと船団が進み、対岸の潮来河岸でも奉祝行事が行われます。潮来河岸から船団が再び出発する光景は、水郷地域の歴史と文化を感じられる特別な機会です。',
    ],
    note: '詳細な祭典・交通情報は、鹿島神宮公式サイトの最新案内をご確認ください。',
    image: {
      src: '/images/sightseeing/mifune-matsuri-2014.jpg',
      alt: '鹿島神宮御船祭で水郷を進む御座船と供奉船',
      credit: '写真：鹿島神宮公式サイト（平成26年御船祭）',
      creditUrl:
        'https://kashimajingu.jp/feature/%E5%B9%B3%E6%88%9026%E5%B9%B4%E5%BE%A1%E8%88%B9%E7%A5%AD/',
    },
    link: {
      label: '御船祭の公式情報を見る',
      url: 'https://kashimajingu.jp/news/%E4%BB%A4%E5%92%8C%E5%85%AB%E5%B9%B4-%E5%BC%8F%E5%B9%B4%E5%A4%A7%E7%A5%AD%E5%BE%A1%E8%88%B9%E7%A5%AD/',
      source: '鹿島神宮',
    },
  },
]

export const sightseeingSpots: SightseeingSpot[] = [
  {
    id: 'ayame-park',
    category: 'SEASONAL / NATURE',
    title: '水郷潮来あやめ園',
    catchcopy: '初夏の潮来を彩る、花菖蒲の風景。',
    description: [
      '潮来を代表する観光スポット。約1.3ヘクタールの園内では、毎年5月下旬から6月下旬にかけて花菖蒲が咲き誇ります。',
      '水郷潮来あやめまつりの期間中には「嫁入り舟」や「あやめ踊り」、手漕ぎの「ろ舟遊覧」など、水郷ならではの催しも行われます。桜、藤、紫陽花など季節ごとの花も楽しめます。',
    ],
    info: [
      { label: '見頃', value: '5月下旬〜6月下旬' },
      { label: '例年の見頃', value: '6月10日頃' },
      { label: '入園', value: '無料・終日入園自由' },
      { label: 'アクセス', value: 'JR潮来駅から徒歩約3分' },
    ],
    image: {
      src: '/images/sightseeing/ayame-park.jpg',
      alt: '夜の水郷潮来あやめ園に咲く花菖蒲と橋',
      credit: '写真：Σ64 / Wikimedia Commons',
      creditUrl:
        'https://commons.wikimedia.org/wiki/File:Suigo_Itako_Ayame_Garden_29.jpg',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    },
    link: {
      label: '潮来市公式情報を見る',
      url: 'https://www.city.itako.lg.jp/kankou/kankou-itakokankou/kankou-spot/kankou-mainspot/kankou-spot03/page001385.html',
      source: '潮来市公式ホームページ',
    },
  },
  {
    id: 'junikyo',
    category: 'EXPERIENCE / WATER',
    title: '十二橋めぐり',
    catchcopy: '舟から出会う、水郷潮来の原風景。',
    description: [
      'かつて水路が生活の道として使われていた水郷潮来。細い水路には、人が一人通れるほどの小さな橋が数多く架けられていました。',
      '遊覧船で巡る「前川十二橋めぐり」と、北利根川を渡って細い水路へ入る「加藤洲十二橋めぐり」があります。あやめまつりの時期には、昔ながらの手漕ぎ舟「ろ舟」も運航されます。',
    ],
    image: {
      src: '/images/sightseeing/junikyo-boat.jpg',
      alt: '前川あやめ園沿いの水路を進む遊覧船',
      credit: '写真：潮来市公式ホームページ',
      creditUrl:
        'https://www.city.itako.lg.jp/kankou/kankou-itakokankou/kankou-spot/kankou-mainspot/kankou-spot02/page001387.html',
    },
    link: {
      label: '十二橋めぐりを見る',
      url: 'https://www.city.itako.lg.jp/kankou/kankou-itakokankou/kankou-spot/kankou-mainspot/kankou-spot02/page001387.html',
      source: '潮来市公式ホームページ',
    },
  },
  {
    id: 'kashima-jingu',
    category: 'HISTORY / SHRINE',
    title: '鹿島神宮',
    catchcopy: '東国を代表する、歴史ある古社へ。',
    description: [
      '潮来富士屋ホテルを拠点に訪ねたい、近郊の代表的な歴史名所。広い境内には重要文化財の社殿や楼門、巨木に包まれた奥参道、澄んだ湧水の御手洗池など、多くのみどころがあります。',
      '静かな森を歩きながら、鹿島の歴史と信仰にふれる時間をお過ごしください。',
    ],
    image: {
      src: '/images/sightseeing/kashima-jingu.jpg',
      alt: '木々に囲まれた鹿島神宮の楼門',
      credit: '写真：Σ64 / Wikimedia Commons',
      creditUrl:
        'https://commons.wikimedia.org/wiki/File:Kashima_Shrine_04.jpg',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    },
    link: {
      label: '鹿島神宮 公式サイト',
      url: 'https://kashimajingu.jp/',
      source: '鹿島神宮',
    },
  },
  {
    id: 'choshoji',
    category: 'HISTORY / TEMPLE',
    title: '長勝寺',
    catchcopy: '潮来の歴史を静かに感じる古刹。',
    description: [
      '潮来市内に佇む、由緒ある寺院。国・県・市指定の文化財を有し、静かな境内で潮来の歴史にふれることができます。',
      '水郷潮来あやめ園とあわせて歩きたい、市内の歴史散策スポットです。',
    ],
    image: {
      src: '/images/sightseeing/choshoji.jpg',
      alt: '桜が咲く長勝寺の参道と本堂',
      credit: '写真：Σ64 / Wikimedia Commons',
      creditUrl:
        'https://commons.wikimedia.org/wiki/File:Kaiunzan_Choshoji_Temple_01.jpg',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    },
    link: {
      label: '詳しく見る',
      url: 'https://www.city.itako.lg.jp/kankou/kankou-itakokankou/kankou-spot/kankou-mainspot/page001390.html',
      source: '潮来市公式ホームページ',
    },
  },
  {
    id: 'michinoeki-itako',
    category: 'LOCAL / SHOPPING',
    title: '道の駅いたこ',
    catchcopy: '潮来のおいしいものと、おみやげ探し。',
    description: [
      '地元の新鮮な農産物や米、加工品、菓子など、潮来ならではのおいしいものとおみやげに出会える道の駅です。',
      '潮来ICからも立ち寄りやすく、車での旅の休憩や地域の観光情報を探す場所としても便利です。',
    ],
    image: {
      src: '/images/sightseeing/michinoeki-itako.jpg',
      alt: '道の駅いたこの建物と正面広場',
      credit: '写真：耕太郎 / Wikimedia Commons',
      creditUrl:
        'https://commons.wikimedia.org/wiki/File:Michinoeki_Itako_20180505.jpg',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    },
    link: {
      label: '公式情報を見る',
      url: 'https://www.michinoeki-itako.jp/',
      source: '道の駅いたこ',
    },
  },
  {
    id: 'sawara',
    category: 'DAY TRIP / HISTORY',
    title: '佐原の町並み',
    catchcopy: '水郷とともに栄えた、歴史ある町並みを歩く。',
    description: [
      '千葉県香取市佐原、小野川沿いに歴史的な商家や町家が残る町並み。川沿いを歩きながら、伊能忠敬旧宅をはじめとする地域の歴史にふれることができます。',
      '水郷のつながりを感じながら、潮来への旅とあわせて巡りたい近郊の散策地です。',
    ],
    image: {
      src: '/images/sightseeing/sawara.jpg',
      alt: '歴史的な商家が並ぶ佐原の町並み',
      credit: '写真：そらみみ / Wikimedia Commons',
      creditUrl:
        'https://commons.wikimedia.org/wiki/File:Street_View_of_Sawara,_Katori.JPG',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    },
    link: {
      label: '佐原観光情報を見る',
      url: 'https://www.city.katori.lg.jp/sightseeing/machinami/',
      source: '香取市 かとり観光Navi',
    },
  },
]

export const sightseeingGroups = [
  {
    eyebrow: 'EXPLORE ITAKO',
    title: '水郷・潮来らしさに出会う',
    description: '花と舟。水辺のまちならではの風景を、ゆっくり巡る。',
    spotIds: ['ayame-park', 'junikyo'],
  },
  {
    eyebrow: 'HISTORY & CULTURE',
    title: '静けさの中に、歴史を訪ねる',
    description: '社寺と森を歩き、この土地に受け継がれてきた時間にふれる。',
    spotIds: ['kashima-jingu', 'choshoji'],
  },
  {
    eyebrow: 'AROUND ITAKO',
    title: '旅を少し先へ',
    description: '土地の味と水郷の町並みへ。滞在とあわせて楽しむ小さな旅。',
    spotIds: ['michinoeki-itako', 'sawara'],
  },
] as const
