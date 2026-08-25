import { useCallback, useEffect, useState } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { Link, useLocation, useParams } from 'react-router-dom'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { GuestNameWithKana } from '../../components/admin/GuestNameWithKana'
import { formatGuestNameWithKana } from '../../components/admin/guest-name'
import { fetchCustomerVisitStats } from '../../features/admin-customers/admin-customers-api'
import { getCustomerVisitLabel } from '../../features/admin-customers/customer-helpers'
import type { CustomerStats } from '../../features/admin-customers/types'
import { getJapanToday } from '../../features/admin-dashboard/dashboard-helpers'
import { formatYen } from '../../features/admin-rates/rate-helpers'
import { mealPlanLabels } from '../../features/booking/meal-plan'
import { isNameKanaOrRomanValid } from '../../features/booking/guest-validation'
import { RateConfirmDialog } from '../../features/admin-rates/RateConfirmDialog'
import {
  assignRoom,
  cancelReservation,
  changeReservationStatus,
  fetchAdminCancellationQuote,
  fetchAssignableRooms,
  fetchReservationDetail,
  markReservationSeen,
  updateAdminPaymentStatus,
  updateReservationContact,
} from '../../features/admin-reservations/admin-reservations-api'
import {
  formatJapanDateTime,
  getAllowedPaymentActions,
  getCheckInPaymentBlockMessage,
  getPaymentActionTarget,
  getPaymentWarning,
  paymentMethodLabels,
  paymentStatusLabels,
  type PaymentAction,
} from '../../features/admin-reservations/payment-helpers'
import { PaymentStatusBadge } from '../../features/admin-reservations/PaymentStatusBadge'
import {
  ADMIN_CHECK_IN_END_TIME,
  ADMIN_CHECK_IN_START_TIME,
  ADMIN_CHECK_IN_TIME_RANGE_MESSAGE,
  bookingSourceLabels,
  getAllowedNextStatuses,
  getRoomAssignmentSummary,
  getTodayOperationLabels,
  reservationStatusLabels,
  isAdminExpectedCheckInTimeValid,
} from '../../features/admin-reservations/reservation-helpers'
import { ReservationStatusBadge } from '../../features/admin-reservations/ReservationStatusBadge'
import type {
  AssignableRoom,
  ReservationDetail,
  ReservationDetailRoom,
  ReservationPayment,
  ReservationStatus,
} from '../../features/admin-reservations/types'
import type { ReservationCancellationQuote } from '../../features/public-reservation/types'
import { useAdminTranslation } from '../../i18n/useAdminTranslation'

type ActionRequest =
  | { type: 'status'; status: Exclude<ReservationStatus, 'cancelled'> }
  | { type: 'cancel' }
  | null

export function ReservationDetailPage() {
  const { t } = useAdminTranslation()
  const { id = '' } = useParams()
  const location = useLocation()
  const returnTo =
    typeof location.state === 'object' &&
    location.state !== null &&
    'reservationsReturnTo' in location.state &&
    typeof location.state.reservationsReturnTo === 'string'
      ? location.state.reservationsReturnTo
      : '/admin/reservations'
  const [reservation, setReservation] = useState<ReservationDetail | null>(null)
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [statusUpdateFailed, setStatusUpdateFailed] = useState(false)
  const [cancellationQuote, setCancellationQuote] =
    useState<ReservationCancellationQuote | null>(null)
  const [editing, setEditing] = useState(false)
  const [action, setAction] = useState<ActionRequest>(null)
  const [paymentAction, setPaymentAction] = useState<PaymentAction | null>(null)
  const [assignmentTarget, setAssignmentTarget] =
    useState<ReservationDetailRoom | null>(null)
  const [candidates, setCandidates] = useState<AssignableRoom[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [draft, setDraft] = useState({
    name: '',
    name_kana_or_roman: '',
    telephone: '',
    email: '',
    expected_check_in_time: '',
    guest_note: '',
    admin_note: '',
  })

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const detail = await fetchReservationDetail(id)
      setReservation(detail)
      if (['pending', 'confirmed'].includes(detail.status)) {
        try {
          setCancellationQuote(await fetchAdminCancellationQuote(detail.id))
        } catch {
          setCancellationQuote(null)
        }
      } else setCancellationQuote(null)
      if (detail.customer_id) {
        try {
          setCustomerStats(await fetchCustomerVisitStats(detail.customer_id))
        } catch {
          setCustomerStats(null)
        }
      } else setCustomerStats(null)
      setDraft({
        name: detail.guest.name,
        name_kana_or_roman: detail.guest.name_kana_or_roman ?? '',
        telephone: detail.guest.telephone,
        email: detail.guest.email,
        expected_check_in_time:
          detail.expected_check_in_time?.slice(0, 5) ?? '',
        guest_note: detail.guest_note ?? '',
        admin_note: detail.admin_note ?? '',
      })
      if (detail.booking_source === 'online' && !detail.admin_seen_at) {
        try {
          const marked = await markReservationSeen(id)
          if (marked)
            setReservation((current) =>
              current
                ? { ...current, admin_seen_at: new Date().toISOString() }
                : current,
            )
        } catch {
          setFeedback('新規予約の確認状態を更新できませんでした。')
        }
      }
    } catch {
      setError('予約情報の取得に失敗しました。')
    } finally {
      setIsLoading(false)
    }
  }, [id])
  useEffect(() => {
    void load()
  }, [load])

  async function saveContact() {
    if (
      !reservation ||
      !draft.name.trim() ||
      !draft.telephone.trim() ||
      !draft.email.trim()
    )
      return setFeedback('氏名・電話番号・メールアドレスを入力してください。')
    if (!isNameKanaOrRomanValid(draft.name_kana_or_roman))
      return setFeedback('フリガナまたは英文名を入力してください。')
    if (
      draft.expected_check_in_time &&
      !isAdminExpectedCheckInTimeValid(draft.expected_check_in_time)
    )
      return setFeedback(ADMIN_CHECK_IN_TIME_RANGE_MESSAGE)
    setIsMutating(true)
    setFeedback(null)
    try {
      await updateReservationContact(
        reservation.id,
        {
          name: draft.name,
          name_kana_or_roman: draft.name_kana_or_roman,
          telephone: draft.telephone,
          email: draft.email,
        },
        {
          expected_check_in_time: draft.expected_check_in_time,
          guest_note: draft.guest_note,
          admin_note: draft.admin_note,
        },
      )
      await load()
      setEditing(false)
      setFeedback('予約情報を更新しました。')
    } catch {
      setFeedback('予約情報を更新できませんでした。')
    } finally {
      setIsMutating(false)
    }
  }

  async function openAssignment(room: ReservationDetailRoom) {
    if (!reservation) return
    setAssignmentTarget(room)
    setSelectedRoomId(room.room_id ?? '')
    setFeedback(null)
    try {
      setCandidates(
        await fetchAssignableRooms({
          reservationRoomId: room.id,
          roomTypeId: room.room_type_id,
          checkIn: reservation.check_in,
          checkOut: reservation.check_out,
        }),
      )
    } catch {
      setFeedback('割り当て可能な客室を取得できませんでした。')
    }
  }
  async function confirmAssignment() {
    if (!assignmentTarget || !selectedRoomId) return
    setIsMutating(true)
    try {
      await assignRoom(assignmentTarget.id, selectedRoomId)
      setAssignmentTarget(null)
      await load()
      setFeedback('客室を割り当てました。')
    } catch {
      setFeedback(
        '客室を割り当てできませんでした。期間が重複していないか確認してください。',
      )
    } finally {
      setIsMutating(false)
    }
  }
  async function confirmAction() {
    if (!reservation || !action) return
    setIsMutating(true)
    setStatusUpdateFailed(false)
    try {
      if (action.type === 'cancel') await cancelReservation(reservation.id)
      else {
        if (action.status === 'checked_in') {
          const latest = await fetchReservationDetail(reservation.id)
          setReservation(latest)
          const paymentBlockMessage = getCheckInPaymentBlockMessage(
            latest.payment,
          )
          if (paymentBlockMessage) {
            setAction(null)
            setFeedback(paymentBlockMessage)
            return
          }
          if (!getRoomAssignmentSummary(latest.rooms).complete) {
            setAction(null)
            setFeedback('客室を割り当ててからチェックインしてください。')
            return
          }
        }
        await changeReservationStatus(reservation.id, action.status)
      }
      setAction(null)
      await load()
      setFeedback('予約状態を更新しました。')
    } catch {
      setAction(null)
      await load()
      setStatusUpdateFailed(true)
      setFeedback(
        '予約状態を更新できませんでした。\n最新の状態を再読み込みしてください。',
      )
    } finally {
      setIsMutating(false)
    }
  }

  async function confirmPaymentAction() {
    if (!reservation?.payment || !paymentAction) return
    const target = getPaymentActionTarget(reservation.payment, paymentAction)
    if (!target) {
      setPaymentAction(null)
      setFeedback('この支払い状態は変更できません。')
      return
    }
    setIsMutating(true)
    setStatusUpdateFailed(false)
    try {
      await updateAdminPaymentStatus({
        paymentId: reservation.payment.id,
        expectedStatus: reservation.payment.status,
        status: target,
      })
      setPaymentAction(null)
      await load()
      setFeedback('支払い状態を更新しました。')
    } catch {
      setPaymentAction(null)
      await load()
      setStatusUpdateFailed(true)
      setFeedback(
        '支払い状態を更新できませんでした。\n最新の状態を再読み込みしてください。',
      )
    } finally {
      setIsMutating(false)
    }
  }

  if (isLoading)
    return (
      <>
        <AdminPageHeader
          title="予約詳細"
          description="予約情報を確認しています。"
        />
        <State text="予約情報を読み込んでいます..." />
      </>
    )
  if (error || !reservation)
    return (
      <>
        <AdminPageHeader
          title="予約詳細"
          description="予約情報を確認できません。"
        />
        <State text={error ?? '予約が見つかりません。'} />
      </>
    )
  const nights = differenceInCalendarDays(
    new Date(`${reservation.check_out}T00:00:00`),
    new Date(`${reservation.check_in}T00:00:00`),
  )
  const nextStatuses = getAllowedNextStatuses(reservation.status)
  const assignment = getRoomAssignmentSummary(reservation.rooms)
  const todayLabels = getTodayOperationLabels(reservation, getJapanToday())
  const paymentWarning = getPaymentWarning(
    reservation.status,
    reservation.payment,
  )
  return (
    <div className="reservation-print-root">
      <div className="print:hidden">
        <AdminPageHeader
          title="予約詳細"
          description={`${reservation.reservation_number} の予約情報です。`}
        />
      </div>
      <div className="mb-6 hidden print:block">
        <h1 className="font-serif text-2xl">潮来富士屋ホテル</h1>
        <p className="mt-2 text-lg">予約票</p>
      </div>
      <div className="mb-6 flex flex-wrap gap-3 print:hidden">
        <Link
          to={returnTo}
          className="inline-flex min-h-11 items-center border border-line bg-surface px-5 text-sm font-semibold"
        >
          一覧へ戻る
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 border border-line bg-surface px-5 text-sm font-semibold"
        >
          印刷
        </button>
        {!['checked_out', 'cancelled', 'no_show'].includes(
          reservation.status,
        ) && (
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="min-h-11 border border-line bg-surface px-5 text-sm font-semibold"
          >
            予約情報を編集
          </button>
        )}
      </div>
      {feedback && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-line bg-surface p-4 text-sm print:hidden"
          role="status"
        >
          <p className="whitespace-pre-line">{feedback}</p>
          {statusUpdateFailed && (
            <button
              type="button"
              onClick={() => void load()}
              className="min-h-10 border border-line px-4 font-semibold"
            >
              再読み込み
            </button>
          )}
        </div>
      )}

      <section className="border border-line bg-surface p-5 sm:p-6 print:border-black">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold text-muted">予約状態</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ReservationStatusBadge status={reservation.status} />
              {todayLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex rounded border border-accent px-3 py-1 text-xs font-semibold text-accent"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="min-w-36 border-l border-line pl-5">
            <p className="text-xs font-semibold text-muted">チェックイン予定</p>
            <p className="mt-1 text-2xl font-semibold">
              {reservation.expected_check_in_time?.slice(0, 5) ?? '未設定'}
            </p>
          </div>
        </div>

        <ReservationStatusActions
          reservation={reservation}
          assignment={assignment}
          nextStatuses={nextStatuses}
          cancellationQuote={cancellationQuote}
          isMutating={isMutating}
          onAction={setAction}
        />
      </section>

      {paymentWarning && (
        <div
          className="mt-4 border border-amber-300 bg-amber-50 p-4 print:border-black print:bg-white"
          role="alert"
        >
          <p className="font-semibold text-amber-900">{paymentWarning.title}</p>
          <p className="mt-1 text-sm text-amber-900">
            {paymentWarning.description}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 print:block">
        <DetailSection title="予約情報">
          <Definition label="予約番号" value={reservation.reservation_number} />
          <Definition
            label="予約状態"
            value={reservationStatusLabels[reservation.status]}
          />
          <Definition
            label="予約経路"
            value={bookingSourceLabels[reservation.booking_source]}
          />
          <Definition
            label="予約日時"
            value={format(new Date(reservation.created_at), 'yyyy/MM/dd HH:mm')}
          />
        </DetailSection>
        <DetailSection title="お客様">
          <Definition
            label="氏名"
            value={
              <GuestNameWithKana
                name={reservation.guest.name}
                nameKanaOrRoman={reservation.guest.name_kana_or_roman}
              />
            }
          />
          <Definition label="電話" value={reservation.guest.telephone} />
          <Definition label="メール" value={reservation.guest.email} />
          {reservation.customer_id && (
            <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
              <Link
                to={`/admin/customers/${reservation.customer_id}`}
                className="inline-flex min-h-10 items-center border border-line px-4 text-xs font-semibold"
              >
                顧客情報を見る
              </Link>
              {customerStats && (
                <span className="rounded bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">
                  {getCustomerVisitLabel(customerStats.completedStays)}
                </span>
              )}
            </div>
          )}
        </DetailSection>
        <DetailSection title="宿泊">
          <Definition
            label="チェックイン"
            value={reservation.check_in.replaceAll('-', '/')}
          />
          <Definition
            label="チェックアウト"
            value={reservation.check_out.replaceAll('-', '/')}
          />
          <Definition label="泊数" value={`${nights}泊`} />
          <Definition
            label="チェックイン予定"
            value={reservation.expected_check_in_time?.slice(0, 5) ?? '未設定'}
          />
        </DetailSection>
        <DetailSection title="お支払い">
          {reservation.payment ? (
            <>
              <Definition
                label="支払い方法"
                value={paymentMethodLabels[reservation.payment.method]}
              />
              <div className="grid grid-cols-[140px_1fr] border-b border-line py-2 text-sm">
                <dt className="text-muted">支払い状態</dt>
                <dd>
                  <PaymentStatusBadge status={reservation.payment.status} />
                </dd>
              </div>
              <Definition
                label="金額"
                value={formatYen(reservation.payment.amount_yen)}
              />
              <Definition
                label="支払い確認日時"
                value={formatJapanDateTime(reservation.payment.paid_at)}
              />
              {reservation.payment.external_reference && (
                <Definition
                  label="外部参照番号"
                  value={reservation.payment.external_reference}
                />
              )}
              <PaymentActions
                payment={reservation.payment}
                isMutating={isMutating}
                onAction={setPaymentAction}
              />
            </>
          ) : (
            <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">支払い情報を確認できません。</p>
              <p className="mt-1">
                {reservation.payment_issue === 'multiple'
                  ? '支払い情報が複数あるため、状態変更を停止しています。'
                  : '支払い情報が登録されていません。'}
              </p>
            </div>
          )}
          {reservation.cancellation_fee_rate !== null && (
            <Definition
              label="キャンセル料"
              value={`${reservation.cancellation_fee_rate}%（${formatYen(reservation.cancellation_fee_yen ?? 0)}）`}
            />
          )}
        </DetailSection>
      </div>

      <DetailSection title="客室">
        <div className="space-y-6">
          {reservation.rooms.map((room, index) => (
            <div key={room.id} className="border border-line bg-background p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">
                    客室 {index + 1}: {room.room_type.name_ja}
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    大人 {room.adult_guest_count}名 / 子ども（有料）{' '}
                    {room.paid_child_count}名 / 無料未就学児{' '}
                    {room.free_preschool_count}名
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {mealPlanLabels[room.meal_plan]}
                  </p>
                  <p className="mt-1 text-sm">
                    実際の客室:{' '}
                    <strong>
                      {room.assigned_room
                        ? `${room.assigned_room.room_number}号室`
                        : '未割当'}
                    </strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void openAssignment(room)}
                  disabled={
                    !['pending', 'confirmed'].includes(reservation.status)
                  }
                  className="min-h-10 border border-line px-4 text-xs font-semibold disabled:opacity-40 print:hidden"
                >
                  {room.room_id ? '割当を変更' : '客室を割り当てる'}
                </button>
              </div>
              <div className="mt-4 border-t border-line pt-3">
                {room.nights.map((night, nightIndex) => (
                  <p key={night.id} className="mt-2 text-sm text-muted">
                    {nightIndex + 1}泊目 {night.stay_date.replaceAll('-', '/')}{' '}
                    / {formatYen(night.price_per_person_yen)} ×{' '}
                    {night.paid_guest_count}名 ={' '}
                    <span className="text-ink">
                      {formatYen(night.room_total_yen)}
                    </span>
                  </p>
                ))}
                <p className="mt-3 text-right font-semibold">
                  客室料金{' '}
                  {formatYen(
                    Math.max(
                      0,
                      (room.quoted_room_total_yen ?? 0) -
                        room.meal_surcharge_yen,
                    ),
                  )}
                  {' / '}夕食追加 {formatYen(room.meal_surcharge_yen)}
                  {' / '}客室合計 {formatYen(room.quoted_room_total_yen ?? 0)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection title="メモ">
        <Definition
          label="お客様からの要望"
          value={reservation.guest_note ?? '—'}
        />
        <Definition label="管理者メモ" value={reservation.admin_note ?? '—'} />
      </DetailSection>

      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4 print:hidden">
          <div className="mx-auto my-8 max-w-2xl bg-surface p-7">
            <h2 className="font-serif text-2xl">予約情報を編集</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {(
                [
                  'name',
                  'name_kana_or_roman',
                  'telephone',
                  'email',
                  'expected_check_in_time',
                ] as const
              ).map((key) => (
                <label key={key}>
                  <span className="mb-2 block text-xs font-semibold text-muted">
                    {
                      {
                        name: '氏名',
                        name_kana_or_roman: t('common.furigana'),
                        telephone: '電話',
                        email: 'メール',
                        expected_check_in_time: 'チェックイン予定時間',
                      }[key]
                    }
                  </span>
                  <input
                    type={
                      key === 'expected_check_in_time'
                        ? 'time'
                        : key === 'email'
                          ? 'email'
                          : 'text'
                    }
                    className="admin-input"
                    min={
                      key === 'expected_check_in_time'
                        ? ADMIN_CHECK_IN_START_TIME
                        : undefined
                    }
                    max={
                      key === 'expected_check_in_time'
                        ? ADMIN_CHECK_IN_END_TIME
                        : undefined
                    }
                    value={draft[key]}
                    onChange={(event) =>
                      setDraft({ ...draft, [key]: event.target.value })
                    }
                  />
                </label>
              ))}
              <label className="md:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-muted">
                  お客様からの要望
                </span>
                <textarea
                  className="admin-input min-h-24"
                  value={draft.guest_note}
                  onChange={(event) =>
                    setDraft({ ...draft, guest_note: event.target.value })
                  }
                />
              </label>
              <label className="md:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-muted">
                  管理者メモ
                </span>
                <textarea
                  className="admin-input min-h-24"
                  value={draft.admin_note}
                  onChange={(event) =>
                    setDraft({ ...draft, admin_note: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="min-h-11 border border-line px-5"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void saveContact()}
                disabled={isMutating}
                className="min-h-11 bg-moss px-5 text-white"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {assignmentTarget && (
        <div className="fixed inset-0 z-50 bg-black/45 p-4 print:hidden">
          <div className="mx-auto mt-24 max-w-lg bg-surface p-7">
            <h2 className="font-serif text-2xl">客室を割り当てる</h2>
            <p className="mt-3 text-sm text-muted">
              {assignmentTarget.room_type.name_ja}
              と期間が一致する割当可能な客室のみ表示します。
            </p>
            <select
              className="admin-input mt-5"
              value={selectedRoomId}
              onChange={(event) => setSelectedRoomId(event.target.value)}
            >
              <option value="">客室を選択</option>
              {candidates.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.room_number}号室
                  {room.sales_status === 'admin_only' ? '（管理者用）' : ''}
                </option>
              ))}
            </select>
            {candidates.length === 0 && (
              <p className="mt-3 text-sm text-red-700">
                割り当て可能な客室がありません。
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAssignmentTarget(null)}
                className="min-h-11 border border-line px-5"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void confirmAssignment()}
                disabled={!selectedRoomId || isMutating}
                className="min-h-11 bg-moss px-5 text-white disabled:opacity-40"
              >
                割り当てる
              </button>
            </div>
          </div>
        </div>
      )}

      {action && (
        <RateConfirmDialog
          {...getActionDialogProperties(action, reservation, cancellationQuote)}
          isMutating={isMutating}
          onCancel={() => setAction(null)}
          onConfirm={() => void confirmAction()}
        />
      )}

      {paymentAction && reservation.payment && (
        <RateConfirmDialog
          {...getPaymentDialogProperties(paymentAction, reservation.payment)}
          isMutating={isMutating}
          onCancel={() => setPaymentAction(null)}
          onConfirm={() => void confirmPaymentAction()}
        />
      )}
    </div>
  )
}

function PaymentActions({
  payment,
  isMutating,
  onAction,
}: {
  payment: ReservationPayment
  isMutating: boolean
  onAction: (action: PaymentAction) => void
}) {
  const actions = getAllowedPaymentActions(payment)
  if (actions.length === 0) return null
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 print:hidden sm:flex-row sm:flex-wrap">
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          onClick={() => onAction(action)}
          disabled={isMutating}
          className={`min-h-11 w-full px-4 text-sm font-semibold disabled:opacity-40 sm:w-auto ${action === 'mark_refunded' ? 'border border-red-300 text-red-700' : action === 'restore_unpaid' ? 'border border-line' : 'bg-moss text-white'}`}
        >
          {getPaymentActionLabel(action, payment)}
        </button>
      ))}
    </div>
  )
}

function getPaymentActionLabel(
  action: PaymentAction,
  payment: ReservationPayment,
): string {
  if (action === 'mark_paid')
    return payment.method === 'bank_transfer'
      ? '入金を確認する'
      : '支払い済みにする'
  if (action === 'restore_unpaid') return '支払い状態を元に戻す'
  return '返金済みにする'
}

function getPaymentDialogProperties(
  action: PaymentAction,
  payment: ReservationPayment,
) {
  const common = `支払い方法\n${paymentMethodLabels[payment.method]}\n\n金額\n${formatYen(payment.amount_yen)}`
  if (action === 'mark_paid')
    return {
      title:
        payment.method === 'bank_transfer'
          ? '入金を確認しますか？'
          : '支払い済みにしますか？',
      description: common,
      confirmLabel:
        payment.method === 'bank_transfer'
          ? '入金を確認する'
          : '支払い済みにする',
    }
  if (action === 'restore_unpaid') {
    const target = getPaymentActionTarget(payment, action)
    return {
      title: '支払い状態を元に戻しますか？',
      description: `${common}\n\n変更後\n${target ? paymentStatusLabels[target] : '—'}\n\n支払い確認日時はクリアされます。`,
      confirmLabel: '元に戻す',
      destructive: true,
    }
  }
  return {
    title: '返金済みにしますか？',
    description: `${common}\n\n実際の返金処理が完了していることを確認してください。\nこの操作は運用上の返金完了記録です。`,
    confirmLabel: '返金済みにする',
    destructive: true,
  }
}

function ReservationStatusActions({
  reservation,
  assignment,
  nextStatuses,
  cancellationQuote,
  isMutating,
  onAction,
}: {
  reservation: ReservationDetail
  assignment: ReturnType<typeof getRoomAssignmentSummary>
  nextStatuses: ReservationStatus[]
  cancellationQuote: ReservationCancellationQuote | null
  isMutating: boolean
  onAction: (action: ActionRequest) => void
}) {
  if (reservation.status === 'checked_out')
    return (
      <p className="mt-5 border-t border-line pt-5 text-sm text-muted">
        予約は完了しています。予約情報の確認と印刷のみ行えます。
      </p>
    )
  if (reservation.status === 'cancelled')
    return (
      <TerminalStatusMessage
        text="この予約はキャンセル済みです。"
        reservation={reservation}
      />
    )
  if (reservation.status === 'no_show')
    return (
      <TerminalStatusMessage
        text="この予約は無連絡不泊として終了しています。"
        reservation={reservation}
      />
    )

  const checkInBlocked =
    reservation.status === 'confirmed' &&
    (!assignment.complete ||
      Boolean(getCheckInPaymentBlockMessage(reservation.payment)))
  const paymentBlockMessage = getCheckInPaymentBlockMessage(reservation.payment)

  return (
    <div className="mt-5 border-t border-line pt-5 print:hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {nextStatuses
          .filter((status) => status !== 'cancelled')
          .map((status) => (
            <button
              key={status}
              type="button"
              onClick={() =>
                onAction({
                  type: 'status',
                  status: status as Exclude<ReservationStatus, 'cancelled'>,
                })
              }
              disabled={
                isMutating || (status === 'checked_in' && checkInBlocked)
              }
              className="min-h-12 w-full bg-moss px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {getStatusActionLabel(status)}
            </button>
          ))}
        {nextStatuses.includes('cancelled') && (
          <button
            type="button"
            onClick={() => onAction({ type: 'cancel' })}
            disabled={isMutating || !cancellationQuote}
            className="min-h-12 w-full border border-red-300 px-5 text-sm font-semibold text-red-700 disabled:opacity-40 sm:w-auto"
          >
            キャンセルする
          </button>
        )}
      </div>
      {checkInBlocked && (
        <p className="mt-4 text-sm font-medium text-red-700" role="alert">
          {!assignment.complete && (
            <>
              {assignment.total}室中 {assignment.unassigned}室が未割当です。
              <br />
              客室を割り当ててからチェックインしてください。
            </>
          )}
          {!assignment.complete && paymentBlockMessage && <br />}
          {paymentBlockMessage}
        </p>
      )}
      {nextStatuses.includes('cancelled') && !cancellationQuote && (
        <p className="mt-4 text-sm font-medium text-red-700" role="alert">
          該当日のキャンセル料は設定されていません。ホテルで確認してください。
        </p>
      )}
    </div>
  )
}

function TerminalStatusMessage({
  text,
  reservation,
}: {
  text: string
  reservation: ReservationDetail
}) {
  return (
    <div className="mt-5 border-t border-line pt-5 text-sm text-muted">
      <p>{text}</p>
      {reservation.cancelled_at && (
        <p className="mt-2">
          処理日時:{' '}
          {format(new Date(reservation.cancelled_at), 'yyyy/MM/dd HH:mm')}
        </p>
      )}
      {reservation.cancellation_fee_rate !== null && (
        <p className="mt-1">
          キャンセル料: {reservation.cancellation_fee_rate}%（
          {formatYen(reservation.cancellation_fee_yen ?? 0)}）
        </p>
      )}
    </div>
  )
}

function getStatusActionLabel(status: ReservationStatus): string {
  if (status === 'checked_in') return 'チェックインする'
  if (status === 'checked_out') return 'チェックアウトする'
  if (status === 'no_show') return '無連絡不泊にする'
  return '予約を確定する'
}

function getActionDialogProperties(
  action: Exclude<ActionRequest, null>,
  reservation: ReservationDetail,
  cancellationQuote: ReservationCancellationQuote | null,
) {
  const rooms = reservation.rooms
    .map((room) =>
      room.assigned_room
        ? `${room.assigned_room.room_number}号室`
        : `${room.room_type.name_ja}（未割当）`,
    )
    .join('・')
  const guestName = formatGuestNameWithKana(
    reservation.guest.name,
    reservation.guest.name_kana_or_roman,
  )
  const common = `予約番号\n${reservation.reservation_number}\n\nお客様\n${guestName}\n\n客室\n${rooms}`

  if (action.type === 'cancel')
    return {
      title: '予約をキャンセルしますか？',
      description: cancellationQuote
        ? `${common}\n\n${cancellationQuote.policyDescriptionJa ?? cancellationQuote.policyCode}\n宿泊日の${cancellationQuote.daysBefore}日前\nキャンセル料: ${cancellationQuote.feePercent}%\n\n予約金額: ${formatYen(reservation.total_amount_yen ?? 0)}\nキャンセル料: ${formatYen(cancellationQuote.feeYen)}\n返金対象額: ${formatYen(cancellationQuote.refundTargetYen)}\n\n自動返金は行いません。割り当て済み客室は解放されます。`
        : `${common}\n\nキャンセル料を確認できません。再読み込みしてください。`,
      confirmLabel: 'キャンセル確定',
      destructive: true,
    }
  if (action.status === 'checked_in')
    return {
      title: 'チェックインしますか？',
      description: common,
      confirmLabel: 'チェックインする',
    }
  if (action.status === 'checked_out')
    return {
      title: 'チェックアウトしますか？',
      description: `${common}\n\nチェックアウト後、この予約は完了状態になります。`,
      confirmLabel: 'チェックアウトする',
    }
  if (action.status === 'no_show')
    return {
      title: '無連絡不泊として処理しますか？',
      description: `${common}\n\nこの操作を行うと予約は終了し、\nキャンセル料100%として記録されます。`,
      confirmLabel: '無連絡不泊にする',
      cancelLabel: '戻る',
      destructive: true,
    }
  return {
    title: '予約を確定しますか？',
    description: common,
    confirmLabel: '予約を確定する',
  }
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-6 border border-line bg-surface p-6 print:border-black print:break-inside-avoid">
      <h2 className="font-serif text-xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}
function Definition({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] border-b border-line py-2 text-sm last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
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
