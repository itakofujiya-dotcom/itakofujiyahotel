import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { BaseRatesEditor } from '../../features/admin-rates/BaseRatesEditor'
import { RateConfirmDialog } from '../../features/admin-rates/RateConfirmDialog'
import { RateOverrideForm } from '../../features/admin-rates/RateOverrideForm'
import { RateOverridesTable } from '../../features/admin-rates/RateOverridesTable'
import { RateRuleCalendar } from '../../features/admin-rates/RateRuleCalendar'
import { RateRulesManager } from '../../features/admin-rates/RateRulesManager'
import type { RateOverride } from '../../features/admin-rates/types'
import { useAdminRates } from '../../features/admin-rates/useAdminRates'
import { useRateRules } from '../../features/admin-rates/useRateRules'

export function RatesAdminPage() {
  const {
    roomTypes,
    baseRates,
    overrides,
    isLoading,
    isMutating: isRateMutating,
    loadError,
    feedback,
    loadRates,
    saveBaseRates,
    addOverride,
    editOverride,
    removeOverride,
  } = useAdminRates()
  const {
    rules,
    ruleDates,
    isLoading: areRulesLoading,
    isMutating: isRuleMutating,
    error: ruleError,
    feedback: ruleFeedback,
    loadRuleData,
    createRule,
    editRule,
    disableRule,
    applyRule,
    removeDate,
    removeDates,
  } = useRateRules()
  const [deleteTarget, setDeleteTarget] = useState<RateOverride | null>(null)

  async function confirmDelete() {
    if (!deleteTarget) return
    if (await removeOverride(deleteTarget.id)) setDeleteTarget(null)
  }

  return (
    <>
      <AdminPageHeader
        title="料金管理"
        description="客室タイプ・人数ごとの基本料金と日付別料金を管理します。"
      />

      {isLoading ? (
        <RatesLoading />
      ) : loadError ? (
        <RatesLoadError message={loadError} onRetry={() => void loadRates()} />
      ) : (
        <div className="space-y-12">
          {feedback && <FeedbackBanner feedback={feedback} />}
          {ruleFeedback && <FeedbackBanner feedback={ruleFeedback} />}

          <BaseRatesEditor
            roomTypes={roomTypes}
            baseRates={baseRates}
            isMutating={isRateMutating}
            onSave={saveBaseRates}
          />

          <RateRulesManager
            rules={rules}
            isLoading={areRulesLoading}
            isMutating={isRuleMutating}
            error={ruleError}
            onRetry={() => void loadRuleData()}
            onCreate={createRule}
            onUpdate={editRule}
            onDisable={disableRule}
          />

          {!areRulesLoading && !ruleError && (
            <RateRuleCalendar
              rules={rules}
              ruleDates={ruleDates}
              baseRates={baseRates}
              isMutating={isRuleMutating}
              onApply={applyRule}
              onRemoveOne={removeDate}
              onRemoveMany={removeDates}
            />
          )}

          <details className="border border-line bg-surface">
            <summary className="cursor-pointer px-6 py-5 font-semibold">
              高度な料金設定（最終金額の直接指定）
            </summary>
            <section
              className="border-t border-line p-6"
              aria-labelledby="override-heading"
            >
              <div className="border-l-4 border-accent bg-[#eee7d9] p-5">
                <p className="text-sm leading-7 text-ink">
                  適用優先順位は「直接指定 → 特別料金ルール →
                  基本料金」です。通常は特別料金ルールを使用してください。
                </p>
              </div>
              <div className="mt-8">
                <p className="eyebrow">LEGACY OVERRIDES</p>
                <h2 id="override-heading" className="font-serif text-2xl">
                  日付別の最終金額
                </h2>
              </div>
              <RateOverrideForm
                roomTypes={roomTypes}
                isMutating={isRateMutating}
                onCreate={addOverride}
              />
              <RateOverridesTable
                overrides={overrides}
                isMutating={isRateMutating}
                onUpdate={editOverride}
                onDeleteRequest={setDeleteTarget}
              />
            </section>
          </details>
        </div>
      )}

      {deleteTarget && (
        <RateConfirmDialog
          title="日付別料金を削除しますか？"
          description={`${format(parseISO(deleteTarget.stay_date), 'yyyy年M月d日')}の${deleteTarget.room_type.name_ja}・${deleteTarget.guest_count}名料金を削除します。削除後は基本料金が適用されます。`}
          confirmLabel="削除する"
          destructive
          isMutating={isRateMutating}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </>
  )
}

function FeedbackBanner({
  feedback,
}: {
  feedback: { type: 'success' | 'error'; message: string }
}) {
  return (
    <div
      role={feedback.type === 'error' ? 'alert' : 'status'}
      className={`border p-4 text-sm ${
        feedback.type === 'success'
          ? 'border-green-200 bg-green-50 text-green-800'
          : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      {feedback.message}
    </div>
  )
}

function RatesLoading() {
  return (
    <div
      className="border border-line bg-surface p-12 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-line border-t-moss" />
      <p className="mt-4 text-sm text-muted">料金情報を読み込んでいます…</p>
    </div>
  )
}

function RatesLoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div
      className="border border-red-200 bg-red-50 p-10 text-center"
      role="alert"
    >
      <p className="text-sm leading-7 text-red-800">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 min-h-11 border border-red-300 px-5 text-sm font-semibold text-red-800"
      >
        再読み込み
      </button>
    </div>
  )
}
