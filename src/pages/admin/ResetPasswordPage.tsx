import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { hotelSettings } from '../../data/hotel'
import { AdminAuthLoading } from '../../features/auth/AdminProtectedRoute'
import { useAdminAuth } from '../../features/auth/use-admin-auth'
import { supabase } from '../../lib/supabase/client'

const minimumPasswordLength = 12

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { isAdmin, isLoading, logout } = useAdminAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    if (password.length < minimumPasswordLength) {
      setMessage(
        `パスワードは${minimumPasswordLength}文字以上で入力してください。`,
      )
      return
    }
    if (password !== confirmation) {
      setMessage('確認用パスワードが一致しません。')
      return
    }

    setIsSubmitting(true)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      console.error('[Admin auth] Password update failed.', {
        code: error.code,
        status: error.status,
      })
      setIsSubmitting(false)
      setMessage(
        'パスワードを変更できませんでした。再設定メールを再度お試しください。',
      )
      return
    }

    await logout()
    navigate('/admin/login', { replace: true, state: { passwordReset: true } })
  }

  if (isLoading) {
    return <AdminAuthLoading message="再設定リンクを確認しています…" />
  }

  if (!isAdmin) {
    return (
      <main
        className="grid min-h-screen place-items-center bg-[#e9ece8] p-5"
        data-admin-i18n-root
      >
        <div className="w-full max-w-md bg-surface p-8 shadow-soft sm:p-10">
          <p className="font-serif text-xl">{hotelSettings.hotelNameJa}</p>
          <h1 className="mt-8 font-serif text-2xl">
            再設定リンクを確認できません
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            リンクの有効期限が切れているか、管理者権限がありません。再設定メールをもう一度送信してください。
          </p>
          <Link
            to="/admin/forgot-password"
            className="mt-6 inline-block text-sm text-accent"
          >
            再設定メールを送信する
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main
      className="grid min-h-screen place-items-center bg-[#e9ece8] p-5"
      data-admin-i18n-root
    >
      <div className="w-full max-w-md bg-surface p-8 shadow-soft sm:p-10">
        <p className="font-serif text-xl">{hotelSettings.hotelNameJa}</p>
        <p className="mt-2 text-xs tracking-[.2em] text-muted">
          UPDATE PASSWORD
        </p>
        <h1 className="mt-8 font-serif text-2xl">新しいパスワードを設定</h1>
        <form className="mt-7 space-y-5" onSubmit={handleSubmit} noValidate>
          <label className="block">
            <span className="mb-2 block text-sm">新しいパスワード</span>
            <input
              className="admin-input"
              type="password"
              autoComplete="new-password"
              minLength={minimumPasswordLength}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm">新しいパスワード（確認）</span>
            <input
              className="admin-input"
              type="password"
              autoComplete="new-password"
              minLength={minimumPasswordLength}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </label>
          {message && (
            <p
              className="rounded border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800"
              role="alert"
            >
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !password || !confirmation}
            className="min-h-12 w-full bg-moss font-semibold text-white transition hover:bg-[#344333] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSubmitting ? '変更しています…' : 'パスワードを変更'}
          </button>
        </form>
      </div>
    </main>
  )
}
