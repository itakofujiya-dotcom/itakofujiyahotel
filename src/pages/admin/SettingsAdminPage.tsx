import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import {
  fetchAdminHotelSettings,
  updateAdminHotelSettings,
} from '../../features/admin-settings/admin-settings-api'
import {
  areAdminHotelSettingsEqual,
  toAdminHotelSettingsForm,
  validateAdminHotelSettings,
} from '../../features/admin-settings/admin-settings-helpers'
import type { AdminHotelSettingsForm } from '../../features/admin-settings/types'

const emptyForm: AdminHotelSettingsForm = {
  hotelNameJa: '',
  hotelNameEn: '',
  postalCode: '',
  addressJa: '',
  telephone: '',
  fax: '',
  email: '',
  checkInTime: '15:00',
  checkOutTime: '10:00',
  frontDeskOpen: '15:00',
  frontDeskClose: '22:00',
}

export function SettingsAdminPage() {
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [form, setForm] = useState<AdminHotelSettingsForm>(emptyForm)
  const [savedForm, setSavedForm] = useState<AdminHotelSettingsForm>(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error'
    message: string
  } | null>(null)

  const isDirty = useMemo(
    () => !areAdminHotelSettingsEqual(form, savedForm),
    [form, savedForm],
  )

  useEffect(() => {
    let active = true
    setIsLoading(true)
    void fetchAdminHotelSettings()
      .then((settings) => {
        if (!active) return
        const next = toAdminHotelSettingsForm(settings)
        setSettingsId(settings.id)
        setForm(next)
        setSavedForm(next)
        setLoadError(null)
      })
      .catch(() => {
        if (active) setLoadError('ホテル基本設定を読み込めませんでした。')
      })
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [])

  function update<K extends keyof AdminHotelSettingsForm>(
    key: K,
    value: AdminHotelSettingsForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
    setFeedback(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settingsId || isSaving || !isDirty) return
    const validation = validateAdminHotelSettings(form)
    if (validation) {
      setFeedback({ kind: 'error', message: validation })
      return
    }
    setIsSaving(true)
    setFeedback(null)
    try {
      const updated = await updateAdminHotelSettings(settingsId, form)
      const next = toAdminHotelSettingsForm(updated)
      setForm(next)
      setSavedForm(next)
      setFeedback({
        kind: 'success',
        message: 'ホテル基本設定を保存しました。',
      })
    } catch {
      setFeedback({
        kind: 'error',
        message: 'ホテル基本設定を保存できませんでした。',
      })
    } finally {
      setIsSaving(false)
    }
  }

  function reset() {
    setForm(savedForm)
    setFeedback(null)
  }

  return (
    <>
      <AdminPageHeader
        title="基本設定"
        description="ホテルの基本情報を管理する画面です。"
      />
      {isLoading ? (
        <StatePanel text="ホテル基本設定を読み込んでいます..." />
      ) : loadError ? (
        <StatePanel text={loadError} />
      ) : (
        <form
          onSubmit={(event) => void submit(event)}
          className="border border-line bg-surface p-6"
          noValidate
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="ホテル名"
              required
              value={form.hotelNameJa}
              onChange={(value) => update('hotelNameJa', value)}
            />
            <TextField
              label="英語名"
              value={form.hotelNameEn}
              onChange={(value) => update('hotelNameEn', value)}
            />
            <TextField
              label="郵便番号"
              value={form.postalCode}
              onChange={(value) => update('postalCode', value)}
              placeholder="311-2424"
            />
            <TextField
              label="住所"
              required
              value={form.addressJa}
              onChange={(value) => update('addressJa', value)}
            />
            <TextField
              label="電話番号"
              required
              type="tel"
              value={form.telephone}
              onChange={(value) => update('telephone', value)}
            />
            <TextField
              label="FAX番号"
              type="tel"
              value={form.fax}
              onChange={(value) => update('fax', value)}
            />
            <TextField
              label="メールアドレス"
              type="email"
              value={form.email}
              onChange={(value) => update('email', value)}
              placeholder="info@example.com"
            />
            <div />
            <TextField
              label="チェックイン"
              type="time"
              required
              value={form.checkInTime}
              onChange={(value) => update('checkInTime', value)}
            />
            <TextField
              label="チェックアウト"
              type="time"
              required
              value={form.checkOutTime}
              onChange={(value) => update('checkOutTime', value)}
            />
            <TextField
              label="フロント対応開始"
              type="time"
              required
              value={form.frontDeskOpen}
              onChange={(value) => update('frontDeskOpen', value)}
            />
            <TextField
              label="フロント対応終了"
              type="time"
              required
              value={form.frontDeskClose}
              onChange={(value) => update('frontDeskClose', value)}
            />
          </div>

          <p className="mt-6 text-sm text-muted">
            変更した内容はホテル情報として保存されます。
          </p>
          {feedback && (
            <p
              className={`mt-4 text-sm ${feedback.kind === 'success' ? 'text-green-800' : 'text-red-700'}`}
              role={feedback.kind === 'error' ? 'alert' : 'status'}
            >
              {feedback.message}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!isDirty || isSaving}
              className="min-h-11 bg-moss px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? '保存しています...' : '変更を保存'}
            </button>
            <button
              type="button"
              disabled={!isDirty || isSaving}
              onClick={reset}
              className="min-h-11 border border-line px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              元に戻す
            </button>
          </div>
        </form>
      )}
    </>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-muted">
        {label}
        {required && <span className="ml-2 text-accent">必須</span>}
      </span>
      <input
        className="admin-input"
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function StatePanel({ text }: { text: string }) {
  return (
    <div
      className="border border-line bg-surface p-12 text-center text-sm text-muted"
      role="status"
    >
      {text}
    </div>
  )
}
