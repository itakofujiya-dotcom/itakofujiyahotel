import { Link } from 'react-router-dom'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import {
  getDashboardMetricLinks,
  getJapanToday,
} from '../../features/admin-dashboard/dashboard-helpers'
import type { DashboardMetricKey } from '../../features/admin-dashboard/types'
import { useAdminDashboard } from '../../features/admin-dashboard/useAdminDashboard'

const metricDefinitions: { key: DashboardMetricKey; label: string }[] = [
  { key: 'todayCheckIns', label: '今日のチェックイン' },
  { key: 'todayCheckOuts', label: '今日のチェックアウト' },
  { key: 'staying', label: '宿泊中' },
  { key: 'newReservations', label: '新規予約' },
  { key: 'pendingReservations', label: '確認待ち' },
  { key: 'pendingPayments', label: '入金待ち' },
]

export function DashboardPage() {
  const { metrics, isLoading, error, loadDashboard } = useAdminDashboard()
  const links = getDashboardMetricLinks(getJapanToday())

  return (
    <>
      <AdminPageHeader
        title="ダッシュボード"
        description="本日の運営状況を確認します。"
      />
      {error && (
        <div
          className="flex flex-wrap items-center justify-between gap-4 border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="min-h-10 border border-red-300 px-4 font-semibold"
          >
            再読み込み
          </button>
        </div>
      )}
      <div
        className={`${error ? 'mt-6' : ''} grid gap-4 sm:grid-cols-2 xl:grid-cols-3`}
      >
        {metricDefinitions.map(({ key, label }) =>
          isLoading ? (
            <article
              key={key}
              className="border border-line bg-surface p-6"
              aria-label={`${label}を読み込み中`}
            >
              <p className="text-sm text-muted">{label}</p>
              <span className="mt-5 block h-9 w-20 animate-pulse rounded bg-stone-200" />
            </article>
          ) : metrics ? (
            <Link
              key={key}
              to={links[key]}
              className="group border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-soft focus-visible:border-accent"
            >
              <p className="text-sm text-muted group-hover:text-accent">
                {label}
              </p>
              <p className="mt-5 text-3xl font-semibold">
                {metrics[key]}
                <span className="ml-1 text-sm font-normal text-muted">件</span>
              </p>
            </Link>
          ) : (
            <article key={key} className="border border-line bg-surface p-6">
              <p className="text-sm text-muted">{label}</p>
              <p className="mt-5 text-sm font-medium text-red-700">取得失敗</p>
            </article>
          ),
        )}
      </div>
    </>
  )
}
