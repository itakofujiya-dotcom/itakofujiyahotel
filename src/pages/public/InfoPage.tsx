import { PageHero } from '../../components/common/PageHero'

export function InfoPage({
  kind,
}: {
  kind: 'reservation' | 'policies' | 'confirm'
}) {
  const content =
    kind === 'reservation'
      ? ['予約確認', '予約番号を使った予約確認機能は準備中です。']
      : kind === 'confirm'
        ? [
            '予約内容の確認',
            '予約内容の確認画面は、予約受付機能と合わせて接続します。',
          ]
        : [
            'ご利用案内',
            'キャンセル・変更・お支払い等の規定は、ホテルでの確認後に掲載します。',
          ]
  return (
    <>
      <PageHero
        eyebrow={kind.toUpperCase()}
        title={content[0]}
        description={content[1]}
      />
      <section className="page-shell py-20">
        <div className="mx-auto max-w-2xl bg-surface p-10 text-center shadow-soft">
          <p className="text-muted">{content[1]}</p>
        </div>
      </section>
    </>
  )
}
