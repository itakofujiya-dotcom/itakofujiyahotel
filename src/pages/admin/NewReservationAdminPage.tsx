import { useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { useAdminRates } from '../../features/admin-rates/useAdminRates'
import { formatYen } from '../../features/admin-rates/rate-helpers'
import { useRateRules } from '../../features/admin-rates/useRateRules'
import { createAdminReservation } from '../../features/admin-reservations/admin-reservations-api'
import {
  ADMIN_CHECK_IN_END_TIME,
  ADMIN_CHECK_IN_START_TIME,
  calculateReservationPricePreview,
  validateAdminReservationInput,
} from '../../features/admin-reservations/reservation-helpers'
import type { CreateAdminReservationInput } from '../../features/admin-reservations/types'
import { mealPlanLabels } from '../../features/booking/meal-plan'
import type { MealPlan } from '../../features/booking/types'

const today = format(new Date(), 'yyyy-MM-dd')
const emptyRoom = {
  room_type_id: '',
  adult_guest_count: 2,
  paid_child_count: 0,
  free_preschool_count: 0,
  meal_plan: 'breakfast' as MealPlan,
}

export function NewReservationAdminPage() {
  const navigate = useNavigate()
  const {
    roomTypes,
    baseRates,
    overrides,
    isLoading: ratesLoading,
    loadError,
  } = useAdminRates()
  const {
    ruleDates,
    isLoading: rulesLoading,
    error: rulesError,
  } = useRateRules()
  const [input, setInput] = useState<CreateAdminReservationInput>({
    guest: {
      name: '',
      name_kana_or_roman: '',
      email: '',
      telephone: '',
      nationality: '',
      postal_code: '',
      address: '',
    },
    reservation: {
      check_in: today,
      check_out: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      booking_source: 'phone',
      expected_check_in_time: ADMIN_CHECK_IN_START_TIME,
      guest_note: '',
      admin_note: '',
    },
    rooms: [{ ...emptyRoom }],
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const preview = useMemo(
    () =>
      calculateReservationPricePreview({
        input,
        baseRates,
        overrides,
        ruleDates,
      }),
    [input, baseRates, overrides, ruleDates],
  )

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const validation = validateAdminReservationInput(input)
    if (validation) return setError(validation)
    if (!preview)
      return setError('料金を計算できません。料金設定を確認してください。')
    setIsSubmitting(true)
    setError(null)
    try {
      const id = await createAdminReservation(input)
      navigate(`/admin/reservations/${id}`)
    } catch {
      setError(
        '予約を登録できませんでした。入力内容と料金設定を確認してください。',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <AdminPageHeader
        title="予約登録"
        description="電話・当日受付・管理者受付の予約を登録します。"
      />
      {ratesLoading || rulesLoading ? (
        <State text="料金情報を読み込んでいます..." />
      ) : loadError || rulesError ? (
        <State text="料金情報を取得できませんでした。" />
      ) : (
        <form onSubmit={submit} className="space-y-8">
          <FormSection title="予約者">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="氏名"
                required
                value={input.guest.name}
                onChange={(value) =>
                  setInput({ ...input, guest: { ...input.guest, name: value } })
                }
              />
              <TextField
                label="フリガナ / 英文名"
                value={input.guest.name_kana_or_roman}
                onChange={(value) =>
                  setInput({
                    ...input,
                    guest: { ...input.guest, name_kana_or_roman: value },
                  })
                }
              />
              <TextField
                label="電話番号"
                required
                value={input.guest.telephone}
                onChange={(value) =>
                  setInput({
                    ...input,
                    guest: { ...input.guest, telephone: value },
                  })
                }
              />
              <TextField
                label="メールアドレス"
                type="email"
                required
                value={input.guest.email}
                onChange={(value) =>
                  setInput({
                    ...input,
                    guest: { ...input.guest, email: value },
                  })
                }
              />
            </div>
          </FormSection>
          <FormSection title="宿泊情報">
            <div className="grid gap-4 md:grid-cols-3">
              <TextField
                label="チェックイン"
                type="date"
                required
                value={input.reservation.check_in}
                onChange={(value) =>
                  setInput({
                    ...input,
                    reservation: { ...input.reservation, check_in: value },
                  })
                }
              />
              <TextField
                label="チェックアウト"
                type="date"
                required
                value={input.reservation.check_out}
                onChange={(value) =>
                  setInput({
                    ...input,
                    reservation: { ...input.reservation, check_out: value },
                  })
                }
              />
              <label>
                <span className="mb-2 block text-xs font-semibold text-muted">
                  予約経路
                </span>
                <select
                  className="admin-input"
                  value={input.reservation.booking_source}
                  onChange={(event) =>
                    setInput({
                      ...input,
                      reservation: {
                        ...input.reservation,
                        booking_source: event.target.value as
                          'phone' | 'walk_in' | 'admin',
                      },
                    })
                  }
                >
                  <option value="phone">電話</option>
                  <option value="walk_in">当日受付</option>
                  <option value="admin">管理者登録</option>
                </select>
              </label>
            </div>
          </FormSection>
          <FormSection title={`客室（${input.rooms.length}/4室）`}>
            <div className="space-y-4">
              {input.rooms.map((room, index) => (
                <div
                  key={index}
                  className="grid gap-4 border border-line bg-background p-4 md:grid-cols-2 xl:grid-cols-[1fr_120px_120px_140px_1fr_auto]"
                >
                  <label>
                    <span className="mb-2 block text-xs font-semibold text-muted">
                      客室タイプ
                    </span>
                    <select
                      className="admin-input"
                      value={room.room_type_id}
                      onChange={(event) =>
                        setInput({
                          ...input,
                          rooms: input.rooms.map((item, roomIndex) =>
                            roomIndex === index
                              ? { ...item, room_type_id: event.target.value }
                              : item,
                          ),
                        })
                      }
                    >
                      <option value="">選択してください</option>
                      {roomTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name_ja}
                        </option>
                      ))}
                    </select>
                  </label>
                  <NumberField
                    label="大人"
                    min={1}
                    max={4}
                    value={room.adult_guest_count}
                    onChange={(value) =>
                      setInput({
                        ...input,
                        rooms: input.rooms.map((item, roomIndex) =>
                          roomIndex === index
                            ? { ...item, adult_guest_count: value }
                            : item,
                        ),
                      })
                    }
                  />
                  <NumberField
                    label="子ども（有料）"
                    min={0}
                    max={3}
                    value={room.paid_child_count}
                    onChange={(value) =>
                      setInput({
                        ...input,
                        rooms: input.rooms.map((item, roomIndex) =>
                          roomIndex === index
                            ? { ...item, paid_child_count: value }
                            : item,
                        ),
                      })
                    }
                  />
                  <NumberField
                    label="無料未就学児"
                    min={0}
                    value={room.free_preschool_count}
                    onChange={(value) =>
                      setInput({
                        ...input,
                        rooms: input.rooms.map((item, roomIndex) =>
                          roomIndex === index
                            ? { ...item, free_preschool_count: value }
                            : item,
                        ),
                      })
                    }
                  />
                  <label>
                    <span className="mb-2 block text-xs font-semibold text-muted">
                      食事プラン
                    </span>
                    <select
                      className="admin-input"
                      value={room.meal_plan}
                      onChange={(event) =>
                        setInput({
                          ...input,
                          rooms: input.rooms.map((item, roomIndex) =>
                            roomIndex === index
                              ? {
                                  ...item,
                                  meal_plan: event.target.value as MealPlan,
                                }
                              : item,
                          ),
                        })
                      }
                    >
                      {Object.entries(mealPlanLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={input.rooms.length === 1}
                    onClick={() =>
                      setInput({
                        ...input,
                        rooms: input.rooms.filter(
                          (_, roomIndex) => roomIndex !== index,
                        ),
                      })
                    }
                    className="self-end min-h-11 border border-red-200 px-4 text-sm text-red-700 disabled:opacity-40"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={input.rooms.length >= 4}
              onClick={() =>
                setInput({
                  ...input,
                  rooms: [...input.rooms, { ...emptyRoom }],
                })
              }
              className="mt-4 min-h-11 border border-line px-5 text-sm font-semibold disabled:opacity-40"
            >
              客室を追加
            </button>
          </FormSection>
          <FormSection title="その他">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="チェックイン予定時間"
                type="time"
                min={ADMIN_CHECK_IN_START_TIME}
                max={ADMIN_CHECK_IN_END_TIME}
                value={input.reservation.expected_check_in_time}
                onChange={(value) =>
                  setInput({
                    ...input,
                    reservation: {
                      ...input.reservation,
                      expected_check_in_time: value,
                    },
                  })
                }
              />
              <div />
              <TextArea
                label="お客様からの要望"
                value={input.reservation.guest_note}
                onChange={(value) =>
                  setInput({
                    ...input,
                    reservation: { ...input.reservation, guest_note: value },
                  })
                }
              />
              <TextArea
                label="管理者メモ"
                value={input.reservation.admin_note}
                onChange={(value) =>
                  setInput({
                    ...input,
                    reservation: { ...input.reservation, admin_note: value },
                  })
                }
              />
            </div>
          </FormSection>
          {preview && (
            <FormSection title="料金プレビュー">
              <div className="space-y-4">
                {preview.rooms.map((room) => (
                  <div
                    key={room.roomIndex}
                    className="border-b border-line pb-4"
                  >
                    <p className="font-semibold">客室 {room.roomIndex + 1}</p>
                    {room.nights.map((night) => (
                      <p
                        key={night.stayDate}
                        className="mt-2 text-sm text-muted"
                      >
                        {night.stayDate.replaceAll('-', '/')} /{' '}
                        {formatYen(night.pricePerPerson)} / 名 / 小計{' '}
                        {formatYen(night.roomTotal)}
                      </p>
                    ))}
                    <p className="mt-2 text-sm text-muted">
                      客室料金 {formatYen(room.baseTotal)} / 夕食追加{' '}
                      {formatYen(room.mealSurcharge)}
                    </p>
                    <p className="mt-1 text-right font-semibold">
                      小計 {formatYen(room.total)}
                    </p>
                  </div>
                ))}
                <p className="text-right text-xl font-semibold">
                  合計 {formatYen(preview.total)}
                </p>
              </div>
            </FormSection>
          )}
          {error && (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-12 bg-moss px-8 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? '登録しています…' : '予約を確定して登録'}
          </button>
        </form>
      )}
    </>
  )
}

function FormSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-line bg-surface p-6 sm:p-8">
      <h2 className="font-serif text-xl">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}
function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  min,
  max,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  min?: string
  max?: string
}) {
  return (
    <label>
      <span className="mb-2 block text-xs font-semibold text-muted">
        {label}
      </span>
      <input
        type={type}
        required={required}
        min={min}
        max={max}
        className="admin-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
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
        type="number"
        min={min}
        max={max}
        step={1}
        className="admin-input"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
function TextArea({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label>
      <span className="mb-2 block text-xs font-semibold text-muted">
        {label}
      </span>
      <textarea
        className="admin-input min-h-28"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
function State({ text }: { text: string }) {
  return (
    <div className="border border-line bg-surface p-12 text-center text-sm text-muted">
      {text}
    </div>
  )
}
