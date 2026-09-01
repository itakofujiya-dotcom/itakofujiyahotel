import { PageHero } from '../../components/common/PageHero'

const faqs = [
  [
    'チェックイン・チェックアウトの時間は？',
    'チェックインは15:00、チェックアウトは10:00です。',
  ],
  ['客室は禁煙ですか？', '全客室禁煙です。'],
]
export function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="よくある質問"
        description="ご宿泊に関するよくあるご質問をご案内します。"
      />
      <section className="page-shell py-16 lg:py-24">
        <div className="mx-auto max-w-3xl divide-y divide-line border-y border-line">
          {faqs.map(([q, a]) => (
            <details key={q} className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-medium">
                <span>
                  <span className="mr-4 font-serif text-accent">Q.</span>
                  {q}
                </span>
                <span className="text-xl transition group-open:rotate-45">
                  ＋
                </span>
              </summary>
              <p className="mt-5 pl-9 leading-8 text-muted">
                <span className="mr-3 font-serif text-moss">A.</span>
                {a}
              </p>
            </details>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-sm text-muted">
          予約・変更・キャンセル・お支払いに関する運用ルールは現在確認中です。
        </p>
      </section>
    </>
  )
}
