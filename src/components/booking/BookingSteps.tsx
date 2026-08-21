const steps = ['空室検索', 'お客様情報', '内容確認', '完了'] as const

export function BookingSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav aria-label="予約手順" className="mb-9">
      <ol className="grid grid-cols-4 gap-1 sm:gap-3">
        {steps.map((step, index) => {
          const number = index + 1
          const active = number === current
          const completed = number < current
          return (
            <li
              key={step}
              aria-current={active ? 'step' : undefined}
              className={`border-t-2 pt-3 text-center text-[10px] sm:text-xs ${
                active
                  ? 'border-accent font-semibold text-accent'
                  : completed
                    ? 'border-moss text-moss'
                    : 'border-line text-muted'
              }`}
            >
              <span className="block">STEP {number}</span>
              <span className="mt-1 block">{step}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
