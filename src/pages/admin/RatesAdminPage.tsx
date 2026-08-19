import { AdminPageHeader } from '../../components/admin/AdminPageHeader'

export function RatesAdminPage() {
  return (
    <>
      <AdminPageHeader
        title="料金管理"
        description="客室タイプ・人数・適用期間ごとの料金を管理します。"
      />
      <div className="border border-line bg-surface p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PreviewField label="客室タイプ" value="未設定" />
          <PreviewField label="適用期間" value="未設定" />
          <PreviewField label="1〜4名料金" value="価格未登録" />
        </div>
        <p className="mt-7 border-t border-line pt-5 text-sm leading-7 text-muted">
          実際の料金は登録していません。ホテルの料金体系が確定後、room_rates と
          rate_overrides に接続します。
        </p>
      </div>
    </>
  )
}
function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-muted">{label}</p>
      <div className="admin-input flex items-center text-muted">{value}</div>
    </div>
  )
}
