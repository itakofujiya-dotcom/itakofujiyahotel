import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { hotelSettings } from '../../data/hotel'
import { supabase } from '../../lib/supabase/client'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [hasNetworkError, setHasNetworkError] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setHasNetworkError(false)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    })
    setIsSubmitting(false)

    if (error) {
      console.error('[Admin auth] Password reset request failed.', {
        code: error.code,
        status: error.status,
      })
      setHasNetworkError(true)
      return
    }

    setIsComplete(true)
  }

  return (
    <main
      className="grid min-h-screen place-items-center bg-[#e9ece8] p-5"
      data-admin-i18n-root
    >
      <div className="w-full max-w-md bg-surface p-8 shadow-soft sm:p-10">
        <p className="font-serif text-xl">{hotelSettings.hotelNameJa}</p>
        <p className="mt-2 text-xs tracking-[.2em] text-muted">
          PASSWORD RESET
        </p>
        <h1 className="mt-8 font-serif text-2xl">パスワードを再設定</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          管理者アカウントのメールアドレスを入力してください。
        </p>

        {isComplete ? (
          <p className="mt-6 rounded border border-green-200 bg-green-50 p-3 text-sm leading-6 text-green-900">
            登録されているメールアドレスの場合、再設定用メールを送信しました。
          </p>
        ) : (
          <form className="mt-7 space-y-5" onSubmit={handleSubmit} noValidate>
            <label className="block">
              <span className="mb-2 block text-sm">メールアドレス</span>
              <input
                className="admin-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </label>
            {hasNetworkError && (
              <p
                className="rounded border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800"
                role="alert"
              >
                通信エラーが発生しました。接続を確認して再度お試しください。
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting || !email.trim()}
              className="min-h-12 w-full bg-moss font-semibold text-white transition hover:bg-[#344333] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isSubmitting ? '送信しています…' : '再設定メールを送信'}
            </button>
          </form>
        )}

        <Link
          to="/admin/login"
          className="mt-6 inline-block text-sm text-accent"
        >
          ← ログイン画面へ戻る
        </Link>
      </div>
    </main>
  )
}
