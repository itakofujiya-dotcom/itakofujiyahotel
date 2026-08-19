import { AdminPageHeader } from '../../components/admin/AdminPageHeader'

export function ReservationsAdminPage() {
  return (
    <>
      <AdminPageHeader
        title="予約管理"
        description="予約状況とお客様情報を管理します。"
      />
      <EmptyPanel
        title="予約データはまだありません"
        text="予約受付機能とSupabase接続後、予約番号・宿泊日・ステータスを表示します。"
      />
    </>
  )
}
export function ReservationDetailPage() {
  return (
    <>
      <AdminPageHeader
        title="予約詳細"
        description="予約・宿泊者・支払いを分けて確認する画面です。"
      />
      <EmptyPanel
        title="予約データ未接続"
        text="URLの予約IDに対応するデータを接続予定です。"
      />
    </>
  )
}
function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="border border-dashed border-line bg-surface p-12 text-center">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-3 text-sm text-muted">{text}</p>
    </div>
  )
}
