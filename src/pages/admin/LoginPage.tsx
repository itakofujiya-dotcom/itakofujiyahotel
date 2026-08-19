import { Link } from 'react-router-dom'
import { hotelSettings } from '../../data/hotel'

export function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#e9ece8] p-5">
      <div className="w-full max-w-md bg-surface p-8 shadow-soft sm:p-10">
        <p className="font-serif text-xl">{hotelSettings.hotelNameJa}</p>
        <p className="mt-2 text-xs tracking-[.2em] text-muted">ADMIN LOGIN</p>
        <form className="mt-9 space-y-5" onSubmit={(e) => e.preventDefault()}>
          <label className="block">
            <span className="mb-2 block text-sm">メールアドレス</span>
            <input className="admin-input" type="email" autoComplete="email" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm">パスワード</span>
            <input
              className="admin-input"
              type="password"
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            className="min-h-12 w-full bg-moss font-semibold text-white"
          >
            ログイン
          </button>
        </form>
        <p className="mt-5 text-xs leading-6 text-muted">
          Supabase Auth接続前の画面です。現在ログインは実行されません。
        </p>
        <Link to="/" className="mt-6 inline-block text-sm text-accent">
          ← ホテルサイトへ戻る
        </Link>
      </div>
    </main>
  )
}
