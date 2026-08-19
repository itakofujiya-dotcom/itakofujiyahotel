import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { hotelSettings } from '../../data/hotel'

export function SettingsAdminPage() {
  const fields = [
    ['ホテル名', hotelSettings.hotelNameJa],
    ['英語名', hotelSettings.hotelNameEn],
    ['住所', `〒${hotelSettings.postalCode} ${hotelSettings.addressJa}`],
    ['電話番号', hotelSettings.telephone],
    ['メールアドレス', '未設定'],
    [
      'チェックイン / アウト',
      `${hotelSettings.checkIn} / ${hotelSettings.checkOut}`,
    ],
    [
      'フロント対応時間',
      `${hotelSettings.frontDeskOpen}〜${hotelSettings.frontDeskClose}`,
    ],
  ]
  return (
    <>
      <AdminPageHeader
        title="基本設定"
        description="ホテルの基本情報を管理する画面です。"
      />
      <div className="grid gap-4 border border-line bg-surface p-6 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <label key={label} className="block">
            <span className="mb-2 block text-xs font-semibold text-muted">
              {label}
            </span>
            <input className="admin-input" value={value} readOnly />
          </label>
        ))}
        <p className="sm:col-span-2 mt-2 text-sm text-muted">
          現在は確認用の読み取り専用表示です。管理者認証とRLS設定後に編集を有効化します。
        </p>
      </div>
    </>
  )
}
