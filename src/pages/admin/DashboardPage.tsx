import { AdminPageHeader } from '../../components/admin/AdminPageHeader'

const metrics = [
  '今日のチェックイン',
  '今日のチェックアウト',
  '宿泊中',
  '新規予約',
  '確認待ち',
  '入金待ち',
]
export function DashboardPage() {
  return (
    <>
      <AdminPageHeader
        title="ダッシュボード"
        description="本日の運営状況を確認します。"
      />
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Supabase接続前の画面です。集計値はデータ接続後に表示されます。
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((label) => (
          <article key={label} className="border border-line bg-surface p-6">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-5 text-sm font-medium text-muted">データ未接続</p>
          </article>
        ))}
      </div>
    </>
  )
}
