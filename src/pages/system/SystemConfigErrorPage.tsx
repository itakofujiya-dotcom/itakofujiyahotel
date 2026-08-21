export function SystemConfigErrorPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-12 text-ink">
      <section
        className="w-full max-w-xl border border-line bg-surface p-8 text-center shadow-soft sm:p-12"
        aria-labelledby="system-config-error-title"
      >
        <p className="text-xs font-semibold tracking-[.24em] text-accent">
          ITAKO FUJIYA HOTEL
        </p>
        <h1 id="system-config-error-title" className="mt-5 font-serif text-3xl">
          システム設定エラー
        </h1>
        <p className="mt-5 text-sm leading-8 text-muted">
          現在、サービスに接続できません。
          <br />
          しばらく時間をおいてから、もう一度お試しください。
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-8 min-h-12 bg-accent px-7 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          再読み込み
        </button>
      </section>
    </main>
  )
}
