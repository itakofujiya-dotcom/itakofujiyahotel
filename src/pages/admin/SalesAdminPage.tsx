import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { fetchAdminSalesReport } from '../../features/admin-sales/admin-sales-api'
import {
  createEmptySalesSummary,
  formatSalesDate,
  formatSalesRoomSummary,
  formatSalesYen,
  getJapanToday,
  getSalesDateRange,
  salesPageSize,
  validateSalesDateRange,
} from '../../features/admin-sales/sales-helpers'
import type {
  SalesDetail,
  SalesPaymentFilter,
  SalesQuickRange,
  SalesReport,
  SalesSort,
  SalesStatusFilter,
} from '../../features/admin-sales/types'
import {
  paymentMethodLabels,
  paymentStatusLabels,
} from '../../features/admin-reservations/payment-helpers'
import { reservationStatusLabels } from '../../features/admin-reservations/reservation-helpers'
import type { PaymentMethod } from '../../features/admin-reservations/types'
import { useAdminTranslation } from '../../i18n/useAdminTranslation'

const quickRanges: {
  value: Exclude<SalesQuickRange, 'custom'>
  label: string
}[] = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '今週' },
  { value: 'month', label: '今月' },
  { value: 'last_month', label: '先月' },
]

const paymentMethods: PaymentMethod[] = [
  'pay_at_hotel',
  'bank_transfer',
  'card',
]

export function SalesAdminPage() {
  const { translate } = useAdminTranslation()
  const initialRange = useMemo(() => getSalesDateRange('month'), [])
  const [quickRange, setQuickRange] = useState<SalesQuickRange>('month')
  const [draftRange, setDraftRange] = useState(initialRange)
  const [range, setRange] = useState(initialRange)
  const [paymentMethod, setPaymentMethod] = useState<SalesPaymentFilter>('all')
  const [status, setStatus] = useState<SalesStatusFilter>('all')
  const [sort, setSort] = useState<SalesSort>('latest')
  const [page, setPage] = useState(1)
  const [report, setReport] = useState<SalesReport>({
    summary: createEmptySalesSummary(),
    details: [],
    totalCount: 0,
  })
  const [printDetails, setPrintDetails] = useState<SalesDetail[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPreparingPrint, setIsPreparingPrint] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rangeError, setRangeError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setReport(
        await fetchAdminSalesReport({
          range,
          paymentMethod,
          status,
          sort,
          page,
        }),
      )
    } catch {
      setError('売上情報を取得できませんでした。')
    } finally {
      setIsLoading(false)
    }
  }, [page, paymentMethod, range, sort, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (printDetails === null) return
    const print = window.requestAnimationFrame(() => window.print())
    const clear = () => setPrintDetails(null)
    window.addEventListener('afterprint', clear, { once: true })
    return () => {
      window.cancelAnimationFrame(print)
      window.removeEventListener('afterprint', clear)
    }
  }, [printDetails])

  function selectQuickRange(value: Exclude<SalesQuickRange, 'custom'>) {
    const nextRange = getSalesDateRange(value)
    setQuickRange(value)
    setDraftRange(nextRange)
    setRange(nextRange)
    setRangeError(null)
    setPage(1)
  }

  function applyCustomRange() {
    const issue = validateSalesDateRange(draftRange)
    setRangeError(issue)
    if (issue) return
    setQuickRange('custom')
    setRange(draftRange)
    setPage(1)
  }

  async function handlePrint() {
    if (isPreparingPrint) return
    setIsPreparingPrint(true)
    setError(null)
    try {
      const printable = await fetchAdminSalesReport({
        range,
        paymentMethod,
        status,
        sort,
        page: 1,
        pageSize: 5000,
      })
      setPrintDetails(printable.details)
    } catch {
      setError('印刷用の売上情報を取得できませんでした。')
    } finally {
      setIsPreparingPrint(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(report.totalCount / salesPageSize))
  const outputDate = getJapanToday()
  const displayedDetails = printDetails ?? report.details

  return (
    <section className="sales-report">
      <div className="sales-screen-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <AdminPageHeader
          title="売上管理"
          description="予約・入金・キャンセル料を期間別に集計します。"
        />
        <button
          type="button"
          onClick={() => void handlePrint()}
          disabled={isLoading || isPreparingPrint}
          className="min-h-11 shrink-0 border border-line bg-surface px-5 text-sm font-semibold disabled:opacity-50"
        >
          {isPreparingPrint ? '印刷データを準備しています…' : '印刷'}
        </button>
      </div>

      <div className="sales-print-only">
        <h1 className="text-2xl font-semibold">
          {translate('潮来富士屋ホテル 売上レポート')}
        </h1>
        <div className="mt-3 flex gap-8 text-sm">
          <p>
            {translate('集計期間')}: {formatSalesDate(range.startDate)}{' '}
            {translate('～')} {formatSalesDate(range.endDate)}
          </p>
          <p>
            {translate('出力日')}: {formatSalesDate(outputDate)}
          </p>
        </div>
      </div>

      <div className="sales-controls mb-7 border border-line bg-surface p-5">
        <div className="flex flex-wrap gap-2">
          {quickRanges.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => selectQuickRange(item.value)}
              className={`min-h-10 px-4 text-sm font-semibold ${quickRange === item.value ? 'bg-moss text-white' : 'border border-line bg-background'}`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setQuickRange('custom')}
            className={`min-h-10 px-4 text-sm font-semibold ${quickRange === 'custom' ? 'bg-moss text-white' : 'border border-line bg-background'}`}
          >
            期間指定
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <DateField
            label="開始日"
            value={draftRange.startDate}
            onChange={(startDate) => {
              setQuickRange('custom')
              setDraftRange((current) => ({ ...current, startDate }))
            }}
          />
          <DateField
            label="終了日"
            value={draftRange.endDate}
            onChange={(endDate) => {
              setQuickRange('custom')
              setDraftRange((current) => ({ ...current, endDate }))
            }}
          />
          <button
            type="button"
            onClick={applyCustomRange}
            className="min-h-11 bg-moss px-6 text-sm font-semibold text-white"
          >
            この期間を表示
          </button>
        </div>
        {rangeError && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {rangeError}
          </p>
        )}

        <div className="mt-5 grid gap-4 border-t border-line pt-5 md:grid-cols-3">
          <SelectField
            label="支払方法"
            value={paymentMethod}
            onChange={(value) => {
              setPaymentMethod(value as SalesPaymentFilter)
              setPage(1)
            }}
            options={[
              ['all', 'すべて'],
              ...paymentMethods.map(
                (method) => [method, paymentMethodLabels[method]] as const,
              ),
            ]}
          />
          <SelectField
            label="予約状態"
            value={status}
            onChange={(value) => {
              setStatus(value as SalesStatusFilter)
              setPage(1)
            }}
            options={[
              ['all', 'すべての状態'],
              ['normal', '通常予約'],
              ['cancelled', 'キャンセル・無連絡不泊'],
              ['completed', '宿泊完了'],
            ]}
          />
          <SelectField
            label="並び順"
            value={sort}
            onChange={(value) => {
              setSort(value as SalesSort)
              setPage(1)
            }}
            options={[
              ['latest', '新しい順'],
              ['oldest', '古い順'],
              ['amount', '金額が高い順'],
            ]}
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <SummaryCards report={report} />
      <PaymentMethodCards report={report} />

      <div className="sales-details mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[.16em] text-accent">
              SALES DETAILS
            </p>
            <h2 className="mt-2 text-2xl font-semibold">売上明細</h2>
          </div>
          <p className="sales-screen-only text-sm text-muted">
            全{report.totalCount}件
          </p>
        </div>

        {isLoading ? (
          <State text="売上情報を読み込んでいます…" />
        ) : displayedDetails.length === 0 ? (
          <State text="選択した期間の売上明細はありません。" />
        ) : (
          <SalesDetailsTable details={displayedDetails} translate={translate} />
        )}
      </div>

      {!isLoading && !error && report.totalCount > 0 && (
        <div className="sales-pagination mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            全{report.totalCount}件 · {page}/{totalPages}ページ
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="min-h-10 border border-line bg-surface px-4 disabled:opacity-40"
            >
              前へ
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="min-h-10 border border-line bg-surface px-4 disabled:opacity-40"
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function SummaryCards({ report }: { report: SalesReport }) {
  const cards = [
    ['予約売上', formatSalesYen(report.summary.reservationRevenueYen)],
    ['入金合計', formatSalesYen(report.summary.collectedYen)],
    ['予約件数', `${report.summary.reservationCount}件`],
    ['宿泊完了', `${report.summary.completedStayCount}件`],
    ['キャンセル料', formatSalesYen(report.summary.cancellationFeeYen)],
    ['返金対象', formatSalesYen(report.summary.refundTargetYen)],
  ]
  return (
    <div className="sales-summary grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(([label, value]) => (
        <article key={label} className="border border-line bg-surface p-5">
          <p className="text-xs font-semibold text-muted">{label}</p>
          <p className="mt-3 text-2xl font-semibold">{value}</p>
        </article>
      ))}
    </div>
  )
}

function PaymentMethodCards({ report }: { report: SalesReport }) {
  return (
    <div className="sales-payment-methods mt-8">
      <h2 className="mb-4 text-xl font-semibold">支払方法別</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {report.summary.paymentMethods.map((item) => (
          <article
            key={item.method}
            className="border border-line bg-surface p-5"
          >
            <h3 className="font-semibold">
              {paymentMethodLabels[item.method]}
            </h3>
            <dl className="mt-4 space-y-2 text-sm">
              <SummaryRow
                label="予約金額"
                value={formatSalesYen(item.reservationRevenueYen)}
              />
              <SummaryRow
                label="入金額"
                value={formatSalesYen(item.collectedYen)}
              />
              <SummaryRow label="予約" value={`${item.reservationCount}件`} />
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}

function SalesDetailsTable({
  details,
  translate,
}: {
  details: SalesDetail[]
  translate: (value: string) => string
}) {
  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="sales-table min-w-[1500px] w-full text-left text-xs">
        <thead className="border-b border-line bg-background text-muted">
          <tr>
            {[
              '日付',
              '予約番号',
              '顧客名',
              'チェックイン',
              'チェックアウト',
              '客室',
              '支払方法',
              '予約金額',
              '売上計上額',
              '入金額',
              'キャンセル料',
              '予約状態',
              '支払状態',
            ].map((heading) => (
              <th key={heading} className="whitespace-nowrap px-3 py-3">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {details.map((detail) => (
            <tr key={detail.reservationId} className="break-inside-avoid">
              <td className="whitespace-nowrap px-3 py-3">
                {formatSalesDate(detail.eventDate)}
              </td>
              <td className="whitespace-nowrap px-3 py-3 font-semibold">
                <Link
                  to={`/admin/reservations/${detail.reservationId}`}
                  className="text-accent print:text-black"
                >
                  {detail.reservationNumber}
                </Link>
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {detail.guestName}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {formatSalesDate(detail.checkIn)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {formatSalesDate(detail.checkOut)}
              </td>
              <td className="px-3 py-3">
                {formatSalesRoomSummary(detail.rooms, translate)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {detail.paymentMethod
                  ? paymentMethodLabels[detail.paymentMethod]
                  : '該当なし'}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {formatSalesYen(detail.reservationAmountYen)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {formatSalesYen(detail.recognizedRevenueYen)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {formatSalesYen(detail.collectedYen)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {formatSalesYen(detail.cancellationFeeYen)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {reservationStatusLabels[detail.reservationStatus]}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {detail.paymentStatus
                  ? paymentStatusLabels[detail.paymentStatus]
                  : detail.paymentIssue === 'multiple'
                    ? '複数あり'
                    : '該当なし'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DateField({
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
      <input
        type="date"
        className="admin-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly (readonly [string, string])[]
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
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
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
