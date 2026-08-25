import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useSiteTranslation } from '../../i18n/useSiteTranslation'
import type { SiteLocale } from '../../i18n/public-translations'

const productionOrigin = 'https://itakofujiyahotel.vercel.app'

type SeoEntry = Record<SiteLocale, { title: string; description: string }>

const defaultSeo: SeoEntry = {
  ja: {
    title: '潮来富士屋ホテル | 茨城県潮来市の宿泊・ホテル予約',
    description:
      '茨城県潮来市の潮来富士屋ホテル。客室、館内施設、アクセス、宿泊予約をご案内します。',
  },
  ko: {
    title: '이타코 후지야 호텔 | 일본 이바라키 이타코 호텔 예약',
    description:
      '일본 이바라키현 이타코시의 이타코 후지야 호텔입니다. 객실, 시설, 교통편과 숙박 예약을 안내합니다.',
  },
}

const routeSeo: Record<string, SeoEntry> = {
  '/rooms': createEntry(
    '客室 | 潮来富士屋ホテル',
    '和室・洋室と客室設備をご案内します。',
    '객실 | 이타코 후지야 호텔',
    '다다미방과 침대방, 객실 설비를 안내합니다.',
  ),
  '/facilities': createEntry(
    '館内施設 | 潮来富士屋ホテル',
    '潮来富士屋ホテルの館内施設をご案内します。旅の疲れをゆったりと癒していただける大浴場など、ご宿泊中にご利用いただける施設をご紹介します。',
    '호텔 시설 | 이타코 후지야 호텔',
    '이타코 후지야 호텔의 시설을 안내합니다. 여행의 피로를 편안하게 풀 수 있는 대욕장 등 투숙 중 이용할 수 있는 시설을 소개합니다.',
  ),
  '/access': createEntry(
    'アクセス | 潮来富士屋ホテル',
    '潮来富士屋ホテルへの交通と潮来駅からのアクセスをご案内します。',
    '오시는 길 | 이타코 후지야 호텔',
    '이타코 후지야 호텔 교통편과 이타코역에서 오는 길을 안내합니다.',
  ),
  '/sightseeing': createEntry(
    '潮来・周辺観光 | 潮来富士屋ホテル',
    '水郷潮来花火大会、鹿島神宮御船祭、水郷潮来あやめ園、十二橋めぐりなど、潮来富士屋ホテル周辺の観光スポットや季節のイベントをご紹介します。',
    '주변 관광 | 이타코 후지야 호텔',
    '수향 이타코의 불꽃축제, 미후네마쓰리, 아야메원과 십이교 유람 등 주변 관광지와 계절 행사를 안내합니다.',
  ),
  '/faq': createEntry(
    'よくある質問 | 潮来富士屋ホテル',
    '宿泊、客室、チェックインに関するよくある質問をご案内します。',
    '자주 묻는 질문 | 이타코 후지야 호텔',
    '숙박, 객실, 체크인에 관한 자주 묻는 질문을 안내합니다.',
  ),
  '/booking': createEntry(
    '空室検索・宿泊予約 | 潮来富士屋ホテル',
    '宿泊日と人数を指定して、空室と料金を検索できます。',
    '객실 검색·숙박 예약 | 이타코 후지야 호텔',
    '숙박 날짜와 인원을 선택해 빈 객실과 요금을 검색할 수 있습니다.',
  ),
  '/reservation': createEntry(
    '予約確認・キャンセル | 潮来富士屋ホテル',
    '予約番号と連絡先から予約内容の確認・キャンセルができます。',
    '예약 조회·취소 | 이타코 후지야 호텔',
    '예약번호와 연락처로 예약 내용을 조회하고 취소할 수 있습니다.',
  ),
  '/terms': createEntry(
    '宿泊約款 | 潮来富士屋ホテル',
    '潮来富士屋ホテルの宿泊約款です。',
    '숙박약관 | 이타코 후지야 호텔',
    '이타코 후지야 호텔의 숙박약관입니다.',
  ),
  '/privacy': createEntry(
    'プライバシーポリシー | 潮来富士屋ホテル',
    '潮来富士屋ホテルの個人情報保護方針です。',
    '개인정보처리방침 | 이타코 후지야 호텔',
    '이타코 후지야 호텔의 개인정보처리방침입니다.',
  ),
  '/cancellation-policy': createEntry(
    'キャンセルポリシー | 潮来富士屋ホテル',
    '潮来富士屋ホテルのキャンセル料と取消条件をご案内します。',
    '취소규정 | 이타코 후지야 호텔',
    '이타코 후지야 호텔의 취소 수수료와 취소 조건을 안내합니다.',
  ),
}

export function PublicSeo() {
  const { pathname } = useLocation()
  const { locale } = useSiteTranslation()

  useEffect(() => {
    const route = normalizeSeoRoute(pathname)
    const seo = (routeSeo[route] ?? defaultSeo)[locale]
    const canonicalUrl = productionOrigin + route

    document.title = seo.title
    setMeta('name', 'description', seo.description)
    setMeta('property', 'og:title', seo.title)
    setMeta('property', 'og:description', seo.description)
    setMeta('property', 'og:url', canonicalUrl)
    setLink('canonical', canonicalUrl)
  }, [locale, pathname])

  return null
}

function createEntry(
  jaTitle: string,
  jaDescription: string,
  koTitle: string,
  koDescription: string,
): SeoEntry {
  return {
    ja: { title: jaTitle, description: jaDescription },
    ko: { title: koTitle, description: koDescription },
  }
}

function normalizeSeoRoute(pathname: string): string {
  if (pathname.startsWith('/booking/')) return '/booking'
  return pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    'meta[' + attribute + '="' + key + '"]',
  )
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

function setLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(
    'link[rel="' + rel + '"]',
  )
  if (!element) {
    element = document.createElement('link')
    element.rel = rel
    document.head.append(element)
  }
  element.href = href
}
