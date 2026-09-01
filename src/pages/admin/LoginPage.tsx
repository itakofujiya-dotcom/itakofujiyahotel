import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { hotelSettings } from '../../data/hotel'
import { AdminAuthLoading } from '../../features/auth/AdminProtectedRoute'
import { useAdminAuth } from '../../features/auth/use-admin-auth'
import type { AdminAccessIssue } from '../../types/admin'
import { AdminLocaleSwitcher } from '../../components/admin/AdminLocaleSwitcher'

const errorMessages: Record<AdminAccessIssue, string> = {
  invalid_credentials: 'メールアドレスまたはパスワードが正しくありません。',
  network_error: '通信エラーが発生しました。接続を確認して再度お試しください。',
  no_profile: '管理者権限がありません。',
  inactive: 'この管理者アカウントは現在利用できません。',
  profile_error:
    '管理者情報を確認できませんでした。時間をおいて再度お試しください。',
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAdmin, isLoading, accessIssue } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formIssue, setFormIssue] = useState<AdminAccessIssue | null>(null)

  useEffect(() => {
    if (!isLoading && isAdmin) navigate('/admin', { replace: true })
  }, [isAdmin, isLoading, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setFormIssue(null)
    const result = await login(email.trim(), password)
    setIsSubmitting(false)

    if (!result.success) {
      setFormIssue(result.issue)
      setPassword('')
      return
    }

    const destination = getRequestedAdminPath(location.state)
    navigate(destination, { replace: true })
  }

  if (isLoading && !isSubmitting) {
    return <AdminAuthLoading message="ログイン状態を確認しています…" />
  }

  if (isAdmin) {
    return <AdminAuthLoading message="管理画面へ移動しています…" />
  }

  const displayedIssue = formIssue ?? accessIssue
  const passwordReset =
    typeof location.state === 'object' &&
    location.state !== null &&
    'passwordReset' in location.state &&
    location.state.passwordReset === true

  return (
    <main
      className="grid min-h-screen place-items-center bg-[#e9ece8] p-5"
      data-admin-i18n-root
    >
      <div className="w-full max-w-md bg-surface p-8 shadow-soft sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-serif text-xl">{hotelSettings.hotelNameJa}</p>
            <p className="mt-2 text-xs tracking-[.2em] text-muted">
              ADMIN LOGIN
            </p>
          </div>
          <AdminLocaleSwitcher />
        </div>
        <form className="mt-9 space-y-5" onSubmit={handleSubmit} noValidate>
          {passwordReset && (
            <p
              className="rounded border border-green-200 bg-green-50 p-3 text-sm leading-6 text-green-900"
              role="status"
            >
              パスワードを変更しました。新しいパスワードでログインしてください。
            </p>
          )}
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
          <label className="block">
            <span className="mb-2 block text-sm">パスワード</span>
            <input
              className="admin-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </label>
          {displayedIssue && (
            <p
              className="rounded border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800"
              role="alert"
            >
              {errorMessages[displayedIssue]}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !email.trim() || !password}
            className="min-h-12 w-full bg-moss font-semibold text-white transition hover:bg-[#344333] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSubmitting ? '確認しています…' : 'ログイン'}
          </button>
        </form>
        <Link
          to="/admin/forgot-password"
          className="mt-5 inline-block text-sm text-accent"
        >
          パスワードをお忘れですか？
        </Link>
        <Link to="/" className="mt-6 inline-block text-sm text-accent">
          ← ホテルサイトへ戻る
        </Link>
      </div>
    </main>
  )
}

function getRequestedAdminPath(state: unknown): string {
  if (
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof state.from === 'string' &&
    state.from.startsWith('/admin') &&
    state.from !== '/admin/login'
  ) {
    return state.from
  }
  return '/admin'
}
