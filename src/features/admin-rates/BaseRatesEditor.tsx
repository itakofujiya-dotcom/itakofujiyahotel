import { useEffect, useMemo, useState } from 'react'
import {
  calculateRoomTotal,
  formatYen,
  getBaseRateChanges,
  parseYenInput,
} from './rate-helpers'
import { RateConfirmDialog } from './RateConfirmDialog'
import type { BaseRateChange, BaseRoomRate, RateRoomType } from './types'

type PendingBaseChange = {
  roomType: RateRoomType
  changes: BaseRateChange[]
}

export function BaseRatesEditor({
  roomTypes,
  baseRates,
  isMutating,
  onSave,
}: {
  roomTypes: RateRoomType[]
  baseRates: BaseRoomRate[]
  isMutating: boolean
  onSave: (changes: BaseRateChange[]) => Promise<boolean>
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<PendingBaseChange | null>(null)

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        baseRates.map((rate) => [rate.id, String(rate.price_per_person_yen)]),
      ),
    )
  }, [baseRates])

  const ratesByType = useMemo(
    () =>
      Object.fromEntries(
        roomTypes.map((roomType) => [
          roomType.id,
          baseRates.filter((rate) => rate.room_type_id === roomType.id),
        ]),
      ),
    [baseRates, roomTypes],
  )

  function requestSave(roomType: RateRoomType) {
    const rates = ratesByType[roomType.id] ?? []
    const changes = getBaseRateChanges(rates, drafts)
    if (!changes) {
      setErrors((current) => ({
        ...current,
        [roomType.id]: '料金は0以上の整数で入力してください。',
      }))
      return
    }
    if (changes.length === 0) return
    setErrors((current) => ({ ...current, [roomType.id]: '' }))
    setPending({ roomType, changes })
  }

  async function confirmSave() {
    if (!pending) return
    if (await onSave(pending.changes)) setPending(null)
  }

  return (
    <section aria-labelledby="base-rate-heading">
      <div>
        <p className="eyebrow">BASE RATES</p>
        <h2 id="base-rate-heading" className="font-serif text-2xl">
          基本料金
        </h2>
        <p className="mt-3 text-sm text-muted">
          表示・保存する金額は1名あたり、税込です。
        </p>
      </div>
      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        {roomTypes.map((roomType) => {
          const rates = ratesByType[roomType.id] ?? []
          const changes = getBaseRateChanges(rates, drafts)
          const hasChanges = changes === null || changes.length > 0
          return (
            <article
              key={roomType.id}
              className="border border-line bg-surface p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-2xl">{roomType.name_ja}</h3>
                  {rates[0] && (
                    <p className="mt-2 text-xs text-muted">
                      適用期間 {rates[0].valid_from} 〜 {rates[0].valid_to}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-background px-3 py-1 text-xs text-muted">
                  1名あたり
                </span>
              </div>

              {rates.length === 0 ? (
                <p className="mt-8 text-sm text-muted">
                  基本料金が登録されていません。
                </p>
              ) : (
                <div className="mt-6 space-y-4">
                  {rates.map((rate) => {
                    const parsed = parseYenInput(drafts[rate.id] ?? '')
                    return (
                      <label
                        key={rate.id}
                        className="grid gap-2 sm:grid-cols-[65px_1fr]"
                      >
                        <span className="pt-3 text-sm font-semibold">
                          {rate.guest_count}名
                        </span>
                        <span>
                          <span className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              value={drafts[rate.id] ?? ''}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [rate.id]: event.target.value,
                                }))
                              }
                              className="admin-input"
                              aria-label={`${roomType.name_ja} ${rate.guest_count}名の1名あたり料金`}
                            />
                            <span className="text-sm text-muted">円</span>
                          </span>
                          {parsed !== null && (
                            <span className="mt-1 block text-xs text-muted">
                              {formatYen(parsed)} × {rate.guest_count}名 ={' '}
                              {formatYen(
                                calculateRoomTotal(parsed, rate.guest_count),
                              )}
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}

              {errors[roomType.id] && (
                <p className="mt-4 text-sm text-red-700" role="alert">
                  {errors[roomType.id]}
                </p>
              )}
              <button
                type="button"
                onClick={() => requestSave(roomType)}
                disabled={!hasChanges || isMutating}
                className="mt-6 min-h-11 bg-moss px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                変更内容を保存
              </button>
            </article>
          )
        })}
      </div>

      {pending && (
        <RateConfirmDialog
          title="基本料金を変更しますか？"
          description="この変更は今後作成される予約料金に反映されます。既存予約の金額は変更されません。"
          isMutating={isMutating}
          onCancel={() => setPending(null)}
          onConfirm={() => void confirmSave()}
        >
          <div className="mt-5 border border-line bg-background p-4">
            <p className="font-semibold">{pending.roomType.name_ja}</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {pending.changes.map((change) => (
                <li key={change.id}>
                  {change.guest_count}名
                  <span className="ml-3">
                    {formatYen(change.previousPrice)} →{' '}
                  </span>
                  <span className="font-semibold text-ink">
                    {formatYen(change.nextPrice)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </RateConfirmDialog>
      )}
    </section>
  )
}
