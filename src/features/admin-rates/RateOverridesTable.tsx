import { useState } from 'react'
import { format, isBefore, parseISO, startOfToday } from 'date-fns'
import { formatYen, parseYenInput } from './rate-helpers'
import type { RateOverride, RateOverrideUpdateInput } from './types'

export function RateOverridesTable({
  overrides,
  isMutating,
  onUpdate,
  onDeleteRequest,
}: {
  overrides: RateOverride[]
  isMutating: boolean
  onUpdate: (id: string, input: RateOverrideUpdateInput) => Promise<boolean>
  onDeleteRequest: (override: RateOverride) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function startEditing(override: RateOverride) {
    setEditingId(override.id)
    setPrice(String(override.price_per_person_yen))
    setReason(override.reason ?? '')
    setError(null)
  }

  async function save(overrideId: string) {
    const parsedPrice = parseYenInput(price)
    if (parsedPrice === null) {
      setError('料金は0以上の整数で入力してください。')
      return
    }
    if (
      await onUpdate(overrideId, {
        price_per_person_yen: parsedPrice,
        reason: reason.trim() || null,
      })
    ) {
      setEditingId(null)
      setError(null)
    }
  }

  if (overrides.length === 0) {
    return (
      <div className="mt-6 border border-dashed border-line bg-surface p-10 text-center text-sm text-muted">
        日付別料金は登録されていません。
      </div>
    )
  }

  return (
    <div className="mt-6 overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-[#eceeea] text-xs text-muted">
          <tr>
            {[
              '適用日',
              '客室タイプ',
              '人数',
              '1名あたり料金',
              '理由',
              '操作',
            ].map((heading) => (
              <th key={heading} scope="col" className="px-4 py-4 font-semibold">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {overrides.map((override) => {
            const isEditing = editingId === override.id
            const isPast = isBefore(
              parseISO(override.stay_date),
              startOfToday(),
            )
            return (
              <tr
                key={override.id}
                className={isPast ? 'bg-stone-50 text-muted' : ''}
              >
                <td className="px-4 py-4">
                  {format(parseISO(override.stay_date), 'yyyy/MM/dd')}
                  {isPast && <span className="ml-2 text-xs">過去</span>}
                </td>
                <td className="px-4 py-4">{override.room_type.name_ja}</td>
                <td className="px-4 py-4">{override.guest_count}名</td>
                <td className="px-4 py-4">
                  {isEditing ? (
                    <span className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        className="admin-input max-w-36"
                        aria-label="1名あたり料金"
                      />
                      円
                    </span>
                  ) : (
                    formatYen(override.price_per_person_yen)
                  )}
                </td>
                <td className="px-4 py-4">
                  {isEditing ? (
                    <input
                      type="text"
                      maxLength={200}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="admin-input"
                      aria-label="理由"
                    />
                  ) : (
                    (override.reason ?? '—')
                  )}
                </td>
                <td className="px-4 py-4">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void save(override.id)}
                        disabled={isMutating}
                        className="min-h-10 bg-moss px-3 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={isMutating}
                        className="min-h-10 border border-line px-3 text-xs font-semibold"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(override)}
                        className="min-h-10 border border-line px-3 text-xs font-semibold"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRequest(override)}
                        className="min-h-10 border border-red-200 px-3 text-xs font-semibold text-red-700"
                      >
                        削除
                      </button>
                    </div>
                  )}
                  {isEditing && error && (
                    <p className="mt-2 text-xs text-red-700" role="alert">
                      {error}
                    </p>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
