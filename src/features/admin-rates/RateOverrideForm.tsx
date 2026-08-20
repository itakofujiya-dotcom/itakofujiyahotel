import { useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import { parseYenInput, validateRateOverrideInput } from './rate-helpers'
import type { RateOverrideCreateInput, RateRoomType } from './types'

export function RateOverrideForm({
  roomTypes,
  isMutating,
  onCreate,
}: {
  roomTypes: RateRoomType[]
  isMutating: boolean
  onCreate: (input: RateOverrideCreateInput) => Promise<boolean>
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [stayDate, setStayDate] = useState('')
  const [roomTypeId, setRoomTypeId] = useState('')
  const [guestCount, setGuestCount] = useState(2)
  const [price, setPrice] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedPrice = parseYenInput(price)
    if (parsedPrice === null) {
      setError('料金は0以上の整数で入力してください。')
      return
    }
    const input: RateOverrideCreateInput = {
      room_type_id: roomTypeId,
      stay_date: stayDate,
      guest_count: guestCount,
      price_per_person_yen: parsedPrice,
      reason: reason.trim() || null,
    }
    const validationError = validateRateOverrideInput(input, today)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    if (await onCreate(input)) {
      setStayDate('')
      setPrice('')
      setReason('')
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 border border-line bg-surface p-6"
      noValidate
    >
      <h3 className="font-semibold">日付別料金を追加</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5 xl:items-end">
        <label>
          <span className="mb-2 block text-xs font-semibold text-muted">
            適用日
          </span>
          <input
            type="date"
            min={today}
            value={stayDate}
            onChange={(event) => setStayDate(event.target.value)}
            className="admin-input"
            required
          />
        </label>
        <label>
          <span className="mb-2 block text-xs font-semibold text-muted">
            客室タイプ
          </span>
          <select
            value={roomTypeId}
            onChange={(event) => setRoomTypeId(event.target.value)}
            className="admin-input"
            required
          >
            <option value="">選択してください</option>
            {roomTypes.map((roomType) => (
              <option key={roomType.id} value={roomType.id}>
                {roomType.name_ja}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-xs font-semibold text-muted">
            人数
          </span>
          <select
            value={guestCount}
            onChange={(event) => setGuestCount(Number(event.target.value))}
            className="admin-input"
          >
            {[1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count}名
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-xs font-semibold text-muted">
            1名あたり料金
          </span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="admin-input"
              required
            />
            <span className="text-sm text-muted">円</span>
          </span>
        </label>
        <label>
          <span className="mb-2 block text-xs font-semibold text-muted">
            理由（任意）
          </span>
          <input
            type="text"
            maxLength={200}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="admin-input"
            placeholder="例：年末料金"
          />
        </label>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isMutating}
        className="mt-5 min-h-11 bg-moss px-5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isMutating ? '保存しています…' : '日付別料金を追加'}
      </button>
    </form>
  )
}
