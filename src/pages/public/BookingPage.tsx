import { useEffect, useMemo, useState } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BookingSearch } from '../../components/booking/BookingSearch'
import { BookingSteps } from '../../components/booking/BookingSteps'
import { PageHero } from '../../components/common/PageHero'
import { formatYen } from '../../features/admin-rates/rate-helpers'
import {
  searchAvailableRoomTypes,
  searchMixedRoomBooking,
} from '../../features/booking/booking-search-api'
import {
  DINNER_SURCHARGE_PER_ADULT_PER_NIGHT_YEN,
  mealPlanLabels,
} from '../../features/booking/meal-plan'
import {
  bookingCompletionStorageKey,
  bookingGuestStorageKey,
  writeBookingDraft,
} from '../../features/booking/storage'
import type {
  AvailableRoomTypeResult,
  BookingDraft,
  BookingRoomInput,
  BookingSearchParams,
  MealPlan,
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
  const [rooms, setRooms] = useState<BookingRoomInput[]>([])
  const [quote, setQuote] = useState<BookingDraft | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isQuoting, setIsQuoting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = parseBookingSearchParams(new URLSearchParams(queryKey))
    if (!params) {
      setResults(null)
      setSearchedParams(null)
      setRooms([])
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
    setQuote(null)
    void searchAvailableRoomTypes(params)
      .then((nextResults) => {
        if (!active) return
        setResults(nextResults)
        setSearchedParams(params)
        const firstType = nextResults[0]
        if (!firstType) return setRooms([])
        const adultDistribution = distribute(params.adults, params.roomCount, 1)
        const childDistribution = distribute(
          params.paidChildren,
          params.roomCount,
        )
        const freeDistribution = distribute(
          params.freePreschoolChildren,
          params.roomCount,
        )
        setRooms(
          Array.from({ length: params.roomCount }, (_, index) => ({
            roomTypeId: firstType.roomTypeId,
            adultGuestCount: adultDistribution[index],
            paidChildCount: childDistribution[index],
            freePreschoolCount: freeDistribution[index],
            mealPlan: 'breakfast' as const,
          })),
        )
      })
      .catch(() => {
        if (!active) return
        setError(
          '空室情報の取得に失敗しました。時間をおいて再度お試しください。',
        )
        setResults(null)
      })
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [queryKey])

  useEffect(() => {
    if (!searchedParams || rooms.length !== searchedParams.roomCount) return
    const validation = validateRoomConfiguration(rooms)
    if (validation) {
      setQuote(null)
      setError(validation)
      return
    }
    let active = true
    const timeout = window.setTimeout(() => {
      setIsQuoting(true)
      setError(null)
      void searchMixedRoomBooking({
        checkIn: searchedParams.checkIn,
        checkOut: searchedParams.checkOut,
        rooms,
      })
        .then((nextQuote) => {
          if (!active) return
          const totals = sumGuests(nextQuote.rooms)
          setQuote({
            ...searchedParams,
            roomCount: nextQuote.rooms.length,
            adults: totals.adults,
            paidChildren: totals.paidChildren,
            freePreschoolChildren: totals.freePreschoolChildren,
            rooms: nextQuote.rooms,
            totalAmountYen: nextQuote.totalAmountYen,
            searchedAt: new Date().toISOString(),
          })
        })
        .catch((quoteError: unknown) => {
          if (!active) return
          setQuote(null)
          setError(
            quoteError instanceof Error &&
              quoteError.message === 'BOOKING_NO_LONGER_AVAILABLE'
              ? '選択した客室の在庫が不足しています。客室タイプを変更してください。'
              : quoteError instanceof Error &&
                  quoteError.message === 'INVALID_BOOKING'
                ? '客室ごとの人数と食事プランをご確認ください。'
                : '料金と空室を確認できませんでした。時間をおいて再度お試しください。',
          )
        })
        .finally(() => active && setIsQuoting(false))
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [rooms, searchedParams])

  function updateRoom(index: number, patch: Partial<BookingRoomInput>) {
    setRooms((current) =>
      current.map((room, roomIndex) =>
        roomIndex === index ? { ...room, ...patch } : room,
      ),
    )
  }

  function proceed() {
    if (!quote) return
    writeBookingDraft(quote)
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
        {isLoading && <LoadingPanel />}
        {error && (
          <p
            className="mt-8 border border-red-200 bg-red-50 p-5 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        )}
        {!isLoading && results && searchedParams && rooms.length > 0 && (
          <RoomConfigurator
            params={searchedParams}
            roomTypes={results}
            rooms={rooms}
            quote={quote}
            isQuoting={isQuoting}
            onUpdate={updateRoom}
            onProceed={proceed}
          />
        )}
      </section>
    </>
  )
}

function RoomConfigurator({
  params,
  roomTypes,
  rooms,
  quote,
  isQuoting,
  onUpdate,
  onProceed,
}: {
  params: BookingSearchParams
  roomTypes: AvailableRoomTypeResult[]
  rooms: BookingRoomInput[]
  quote: BookingDraft | null
  isQuoting: boolean
  onUpdate: (index: number, patch: Partial<BookingRoomInput>) => void
  onProceed: () => void
}) {
  const nights = differenceInCalendarDays(
    new Date(`${params.checkOut}T00:00:00`),
    new Date(`${params.checkIn}T00:00:00`),
  )
  const quoteByIndex = useMemo(
    () => new Map(quote?.rooms.map((room) => [room.roomIndex, room])),
    [quote],
  )
  return (
    <div className="mt-10">
      <p className="eyebrow">ROOM SELECTION</p>
      <h2 className="font-serif text-3xl">客室ごとの内容</h2>
      <p className="mt-3 text-sm leading-7 text-muted">
        {params.checkIn.replaceAll('-', '/')} →{' '}
        {params.checkOut.replaceAll('-', '/')} · {nights}泊 · {rooms.length}室
      </p>
      <div className="mt-7 space-y-6">
        {rooms.map((room, index) => {
          const roomQuote = quoteByIndex.get(index)
          return (
            <section
              key={index}
              className="border border-line bg-surface p-5 shadow-soft sm:p-7"
            >
              <h3 className="font-serif text-xl">客室 {index + 1}</h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SelectField
                  label="客室タイプ"
                  value={room.roomTypeId}
                  onChange={(value) => onUpdate(index, { roomTypeId: value })}
                >
                  {roomTypes.map((type) => (
                    <option key={type.roomTypeId} value={type.roomTypeId}>
                      {type.nameJa}
                    </option>
                  ))}
                </SelectField>
                <NumberField
                  label="大人"
                  min={1}
                  max={4}
                  value={room.adultGuestCount}
                  onChange={(value) =>
                    onUpdate(index, { adultGuestCount: value })
                  }
                />
                <NumberField
                  label="子ども（有料）"
                  min={0}
                  max={3}
                  value={room.paidChildCount}
                  onChange={(value) =>
                    onUpdate(index, { paidChildCount: value })
                  }
                />
                <NumberField
                  label="添い寝の未就学児"
                  min={0}
                  value={room.freePreschoolCount}
                  onChange={(value) =>
                    onUpdate(index, { freePreschoolCount: value })
                  }
                />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {(['breakfast', 'breakfast_dinner'] as MealPlan[]).map(
                  (mealPlan) => (
                    <label
                      key={mealPlan}
                      className={`cursor-pointer border p-4 ${room.mealPlan === mealPlan ? 'border-accent bg-[#eee7d9]' : 'border-line'}`}
                    >
                      <span className="flex items-start gap-3">
                        <input
                          type="radio"
                          name={`meal-${index}`}
                          checked={room.mealPlan === mealPlan}
                          onChange={() => onUpdate(index, { mealPlan })}
                        />
                        <span>
                          <strong className="block">
                            {mealPlanLabels[mealPlan]}
                          </strong>
                          <span className="mt-1 block text-xs text-muted">
                            {mealPlan === 'breakfast'
                              ? '追加料金なし'
                              : `大人1名・1泊につき +${formatYen(DINNER_SURCHARGE_PER_ADULT_PER_NIGHT_YEN)}`}
                          </span>
                        </span>
                      </span>
                    </label>
                  ),
                )}
              </div>
              {roomQuote && (
                <div className="mt-5 grid gap-2 border-t border-line pt-4 text-sm sm:grid-cols-3">
                  <p>
                    客室料金{' '}
                    <strong>{formatYen(roomQuote.baseRoomTotalYen)}</strong>
                  </p>
                  <p>
                    夕食追加{' '}
                    <strong>{formatYen(roomQuote.mealSurchargeYen)}</strong>
                  </p>
                  <p className="sm:text-right">
                    小計 <strong>{formatYen(roomQuote.subtotalYen)}</strong>
                  </p>
                </div>
              )}
            </section>
          )
        })}
      </div>
      <div className="mt-7 flex flex-col gap-4 border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">予定料金</p>
          <p className="mt-1 text-2xl font-semibold">
            {quote ? formatYen(quote.totalAmountYen) : '確認中'}
          </p>
        </div>
        <button
          type="button"
          disabled={!quote || isQuoting}
          onClick={onProceed}
          className="min-h-12 bg-accent px-7 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {isQuoting ? '料金を確認しています...' : 'お客様情報の入力へ'}
        </button>
      </div>
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <label>
      <span className="mb-2 block text-xs font-semibold text-muted">
        {label}
      </span>
      <select
        className="admin-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max?: number
}) {
  return (
    <label>
      <span className="mb-2 block text-xs font-semibold text-muted">
        {label}
      </span>
      <input
        className="admin-input"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function LoadingPanel() {
  return (
    <div
      className="mt-8 border border-line bg-surface p-10 text-center"
      role="status"
    >
      <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-line border-t-accent" />
      <p className="mt-4 text-sm text-muted">空室を確認しています...</p>
    </div>
  )
}

function distribute(total: number, count: number, minimum = 0): number[] {
  const remaining = total - minimum * count
  const base = Math.floor(Math.max(remaining, 0) / count)
  const remainder = Math.max(remaining, 0) % count
  return Array.from(
    { length: count },
    (_, index) => minimum + base + (index < remainder ? 1 : 0),
  )
}

function validateRoomConfiguration(rooms: BookingRoomInput[]): string | null {
  if (rooms.length < 1 || rooms.length > 4)
    return '客室数は1〜4室で指定してください。'
  for (const room of rooms) {
    if (!room.roomTypeId) return 'すべての客室タイプを選択してください。'
    if (!Number.isInteger(room.adultGuestCount) || room.adultGuestCount < 1)
      return '各客室に大人1名以上を指定してください。'
    if (
      !Number.isInteger(room.paidChildCount) ||
      room.paidChildCount < 0 ||
      room.adultGuestCount + room.paidChildCount > 4
    )
      return '有料のお客様は1室あたり最大4名です。'
    if (
      !Number.isInteger(room.freePreschoolCount) ||
      room.freePreschoolCount < 0
    )
      return '添い寝のお子様の人数を確認してください。'
  }
  return null
}

function sumGuests(rooms: BookingRoomInput[]) {
  return rooms.reduce(
    (totals, room) => ({
      adults: totals.adults + room.adultGuestCount,
      paidChildren: totals.paidChildren + room.paidChildCount,
      freePreschoolChildren:
        totals.freePreschoolChildren + room.freePreschoolCount,
    }),
    { adults: 0, paidChildren: 0, freePreschoolChildren: 0 },
  )
}
