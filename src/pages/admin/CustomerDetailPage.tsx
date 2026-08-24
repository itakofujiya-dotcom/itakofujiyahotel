import { differenceInCalendarDays } from 'date-fns'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { GuestNameWithKana } from '../../components/admin/GuestNameWithKana'
import { formatGuestNameWithKana } from '../../components/admin/guest-name'
import {
  fetchCustomerDetail,
  updateCustomerMemo,
} from '../../features/admin-customers/admin-customers-api'
import {
  formatCustomerDate,
  getCustomerVisitLabel,
} from '../../features/admin-customers/customer-helpers'
import type { CustomerDetail } from '../../features/admin-customers/types'
import { paymentMethodLabels } from '../../features/admin-reservations/payment-helpers'
import { ReservationStatusBadge } from '../../features/admin-reservations/ReservationStatusBadge'

export function CustomerDetailPage() {
  const { id = '' } = useParams()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [memo, setMemo] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const detail = await fetchCustomerDetail(id)
      setCustomer(detail)
      setMemo(detail.memo ?? '')
    } catch {
      setError('顧客情報を取得できませんでした。')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function saveMemo() {
    if (!customer || isSaving) return
    setIsSaving(true)
    setFeedback(null)
    try {
      await updateCustomerMemo(customer.id, memo)
      setCustomer({ ...customer, memo: memo.trim() || null })
      setFeedback('顧客メモを保存しました。')
    } catch {
      setFeedback('顧客メモを保存できませんでした。')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading)
    return (
      <>
        <AdminPageHeader
          title="顧客詳細"
          description="顧客情報を確認しています。"
        />
        <State text="顧客情報を読み込んでいます..." />
      </>
    )
  if (error || !customer)
    return (
      <>
        <AdminPageHeader
          title="顧客詳細"
          description="顧客情報を確認できません。"
        />
        <State text={error ?? '顧客が見つかりません。'} />
      </>
    )

  return (
    <>
      <AdminPageHeader
        title={formatGuestNameWithKana(customer.name, customer.nameKanaOrRoman)}
        description="顧客情報、再訪状況、予約履歴を確認します。"
      />
      <div className="mb-6">
        <Link
          to="/admin/customers"
          className="inline-flex min-h-11 items-center border border-line bg-surface px-5 text-sm font-semibold"
        >
          顧客一覧へ戻る
        </Link>
      </div>

      <section className="border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold text-muted">氏名</p>
            <GuestNameWithKana
              name={customer.name}
              nameKanaOrRoman={customer.nameKanaOrRoman}
              className="mt-2"
              nameClassName="font-serif text-2xl"
              kanaClassName="mt-1 text-sm text-muted"
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-muted">電話番号</p>
                <p className="mt-1 text-sm">{customer.phone}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted">メール</p>
                <p className="mt-1 break-words text-sm">
                  {customer.email ?? '—'}
                </p>
              </div>
            </div>
          </div>
          <span className="rounded bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">
            {getCustomerVisitLabel(customer.completedStays)}
          </span>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="総訪問回数" value={`${customer.completedStays}回`} />
          <Stat
            label="初回訪問"
            value={formatCustomerDate(customer.firstVisit)}
          />
          <Stat
            label="最近の訪問"
            value={formatCustomerDate(customer.recentVisit)}
          />
          <Stat label="総宿泊数" value={`${customer.totalNights}泊`} />
          <Stat
            label="平均訪問間隔"
            value={
              customer.averageVisitIntervalDays === null
                ? '—'
                : `${customer.averageVisitIntervalDays}日`
            }
          />
        </div>
        <p className="mt-4 text-xs text-muted">
          総予約数: {customer.totalReservations}
          件。訪問統計はチェックアウト済みの予約のみ集計しています。
        </p>
      </section>

      <section className="mt-6 border border-line bg-surface p-6">
        <h2 className="font-serif text-xl">顧客メモ</h2>
        <p className="mt-2 text-sm text-muted">
          今後の訪問でも参照する管理者専用メモです。予約ごとのメモとは別に保存されます。
        </p>
        <textarea
          className="admin-input mt-5 min-h-32 py-3"
          value={memo}
          maxLength={2000}
          onChange={(event) => setMemo(event.target.value)}
          placeholder="例: 静かな部屋を希望"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" role="status">
            {feedback}
          </p>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void saveMemo()}
            className="min-h-11 bg-moss px-6 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving ? '保存中…' : '顧客メモを保存'}
          </button>
        </div>
      </section>

      <section className="mt-6 border border-line bg-surface p-6">
        <h2 className="font-serif text-xl">予約・宿泊履歴</h2>
        {customer.reservations.length === 0 ? (
          <p className="mt-5 text-sm text-muted">予約履歴はありません。</p>
        ) : (
          <div className="mt-5 space-y-3">
            {customer.reservations.map((reservation) => {
              const nights = differenceInCalendarDays(
                new Date(`${reservation.check_out}T00:00:00`),
                new Date(`${reservation.check_in}T00:00:00`),
              )
              const roomTypes = [
                ...new Set(
                  reservation.rooms.map((room) => room.room_type.name_ja),
                ),
              ].join('・')
              return (
                <Link
                  key={reservation.id}
                  to={`/admin/reservations/${reservation.id}`}
                  className="block border border-line p-5 transition hover:bg-background"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">
                        {reservation.reservation_number}
                      </p>
                      <p className="mt-2 text-sm text-muted">
                        {formatCustomerDate(reservation.check_in)}〜
                        {formatCustomerDate(reservation.check_out)} · {nights}泊
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {roomTypes || '客室情報なし'} ·{' '}
                        {reservation.payment
                          ? paymentMethodLabels[reservation.payment.method]
                          : '支払い情報なし'}
                      </p>
                    </div>
                    <ReservationStatusBadge status={reservation.status} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-background p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  )
}

function State({ text }: { text: string }) {
  return (
    <div className="border border-line bg-surface p-12 text-center text-sm text-muted">
      {text}
    </div>
  )
}
