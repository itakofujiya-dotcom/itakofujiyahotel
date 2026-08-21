import { useEffect, useState } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BookingSearch } from '../../components/booking/BookingSearch'
import { BookingSteps } from '../../components/booking/BookingSteps'
import { PageHero } from '../../components/common/PageHero'
import { formatYen } from '../../features/admin-rates/rate-helpers'
import { searchAvailableRoomTypes } from '../../features/booking/booking-search-api'
import {
  bookingCompletionStorageKey,
  bookingGuestStorageKey,
  writeBookingDraft,
} from '../../features/booking/storage'
import type {
  AvailableRoomTypeResult,
  BookingDraft,
  BookingSearchParams,
} from '../../features/booking/types'
import {
  parseBookingSearchParams,
  validateBookingSearch,
} from '../../features/booking/validation'

export function BookingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryKey = searchParams.toString()
  const [results, setResults] = useState<AvailableRoomTypeResult[] | null>(null)
  const [searchedParams, setSearchedParams] =
    useState<BookingSearchParams | null>(null)
  const [selectedDraft, setSelectedDraft] = useState<BookingDraft | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = parseBookingSearchParams(new URLSearchParams(queryKey))
    if (!params) {
      setResults(null)
      setSearchedParams(null)
      return
    }
    const validation = validateBookingSearch(params)
    if (validation) {
      setError(validation)
      setResults(null)
      return
    }

    let active = true
    setIsLoading(true)
    setError(null)
    setSelectedDraft(null)
    void searchAvailableRoomTypes(params)
      .then((nextResults) => {
        if (!active) return
        setResults(nextResults)
        setSearchedParams(params)
      })
      .catch(() => {
        if (!active) return
        setError(
          '空室情報の取得に失敗しました。時間をおいて再度お試しください。',
        )
        setResults(null)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [queryKey])

  function selectRoom(result: AvailableRoomTypeResult) {
    if (!searchedParams || !result.isAvailable) return
    const draft: BookingDraft = {
      ...searchedParams,
      selectedRoomType: {
        id: result.roomTypeId,
        code: result.code,
        nameJa: result.nameJa,
      },
      guestDistribution: result.guestDistribution,
      nightlyPrices: result.nightlyPrices,
      totalAmountYen: result.totalAmountYen,
      searchedAt: new Date().toISOString(),
    }
    setSelectedDraft(draft)
    writeBookingDraft(draft)
    sessionStorage.removeItem(bookingGuestStorageKey)
    sessionStorage.removeItem(bookingCompletionStorageKey)
    navigate('/booking/details')
  }

  return (
    <>
      <PageHero
        eyebrow="BOOKING"
        title="空室検索・宿泊予約"
        description="ご希望の宿泊日と人数を入力してください。"
      />
      <section className="page-shell py-14 lg:py-20">
        <BookingSteps current={1} />
        <BookingSearch isLoading={isLoading} />
        {isLoading && (
          <div
            className="mt-8 border border-line bg-surface p-10 text-center"
            role="status"
          >
            <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-line border-t-accent" />
            <p className="mt-4 text-sm text-muted">空室を確認しています...</p>
          </div>
        )}
        {error && (
          <p
            className="mt-8 border border-red-200 bg-red-50 p-5 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        )}
        {!isLoading && results && searchedParams && (
          <BookingResults
            params={searchedParams}
            results={results}
            selectedDraft={selectedDraft}
            onSelect={selectRoom}
          />
        )}
      </section>
    </>
  )
}

function BookingResults({
  params,
  results,
  selectedDraft,
  onSelect,
}: {
  params: BookingSearchParams
  results: AvailableRoomTypeResult[]
  selectedDraft: BookingDraft | null
  onSelect: (result: AvailableRoomTypeResult) => void
}) {
  const nights = differenceInCalendarDays(
    new Date(`${params.checkOut}T00:00:00`),
    new Date(`${params.checkIn}T00:00:00`),
  )
  const paidGuests = params.adults + params.paidChildren
  const anyAvailable = results.some((result) => result.isAvailable)

  return (
    <div className="mt-10">
      <p className="eyebrow">SEARCH RESULTS</p>
      <h2 className="font-serif text-3xl">空室検索結果</h2>
      <p className="mt-3 text-sm leading-7 text-muted">
        {params.checkIn.replaceAll('-', '/')} →{' '}
        {params.checkOut.replaceAll('-', '/')} · {nights}泊 · 有料
        {paidGuests}名 · {params.roomCount}室
        {params.freePreschoolChildren > 0 &&
          ` · 添い寝の未就学児 ${params.freePreschoolChildren}名`}
      </p>

      {!anyAvailable && (
        <p className="mt-6 border border-line bg-surface p-6 text-sm leading-7 text-muted">
          ご指定の条件で空室が見つかりませんでした。日付や人数を変更して再度お試しください。
        </p>
      )}

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        {results.map((result) => (
          <RoomAvailabilityCard
            key={result.roomTypeId}
            result={result}
            roomCount={params.roomCount}
            selected={selectedDraft?.selectedRoomType.id === result.roomTypeId}
            onSelect={() => onSelect(result)}
          />
        ))}
      </div>
      {selectedDraft && (
        <div
          className="mt-7 border-l-4 border-accent bg-[#eee7d9] p-5"
          role="status"
        >
          <p className="font-semibold">
            {selectedDraft.selectedRoomType.nameJa}を選択しました。
          </p>
          <p className="mt-2 text-sm text-muted">
            次の予約者情報入力ステップで、空室と料金をサーバーでもう一度確認します。
          </p>
        </div>
      )}
    </div>
  )
}

function RoomAvailabilityCard({
  result,
  roomCount,
  selected,
  onSelect,
}: {
  result: AvailableRoomTypeResult
  roomCount: number
  selected: boolean
  onSelect: () => void
}) {
  return (
    <article
      className={`border bg-surface p-6 shadow-soft sm:p-8 ${selected ? 'border-accent ring-1 ring-accent' : 'border-line'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[.18em] text-accent">
            {result.code === 'japanese' ? 'JAPANESE ROOM' : 'WESTERN ROOM'}
          </p>
          <h3 className="mt-2 font-serif text-2xl">{result.nameJa}</h3>
        </div>
        <span
          className={`rounded px-3 py-1 text-xs font-semibold ${result.isAvailable ? 'bg-green-100 text-green-800' : 'bg-stone-200 text-muted'}`}
        >
          {result.isAvailable ? '予約可能' : '満室'}
        </span>
      </div>
      <p className="mt-5 text-sm text-muted">
        {result.isAvailable
          ? `残り${result.availableQuantity}室`
          : `残り${result.availableQuantity}室 · ご希望の${roomCount}室を確保できません`}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-4 border-y border-line py-5">
        <div>
          <p className="text-xs text-muted">1名あたり</p>
          <p className="mt-1 text-lg font-semibold">
            {formatYen(result.minPricePerPersonYen)}〜
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">宿泊合計</p>
          <p className="mt-1 text-lg font-semibold">
            {formatYen(result.totalAmountYen)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">
        客室ごとの有料人数: {result.guestDistribution.join('名・')}名
      </p>
      <details className="mt-5 border border-line">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
          料金詳細
        </summary>
        <div className="border-t border-line px-4 py-3">
          {result.nightlyPrices.map((night) => (
            <div
              key={night.stayDate}
              className="border-b border-line py-3 last:border-0"
            >
              <p className="text-sm font-semibold">
                {night.stayDate.replaceAll('-', '/')}
                {night.rooms.some((room) => room.isSpecialRate) && (
                  <span className="ml-2 rounded bg-[#eee7d9] px-2 py-0.5 text-[10px] text-accent">
                    特別料金
                  </span>
                )}
              </p>
              {night.rooms.map((room) => (
                <p key={room.roomIndex} className="mt-2 text-xs text-muted">
                  客室{room.roomIndex + 1}: {formatYen(room.pricePerPersonYen)}{' '}
                  × {room.guestCount}名 = {formatYen(room.roomTotalYen)}
                </p>
              ))}
              <p className="mt-2 text-right text-sm">
                小計 {formatYen(night.nightTotalYen)}
              </p>
            </div>
          ))}
        </div>
      </details>
      <button
        type="button"
        onClick={onSelect}
        disabled={!result.isAvailable}
        className="mt-6 min-h-12 w-full bg-moss px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {selected ? '選択済み' : 'この客室を選択'}
      </button>
    </article>
  )
}
