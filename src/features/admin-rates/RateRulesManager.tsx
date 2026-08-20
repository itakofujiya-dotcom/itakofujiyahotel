import { useState, type FormEvent } from 'react'
import { formatAdjustment, parseSignedInteger } from './rate-helpers'
import { RateConfirmDialog } from './RateConfirmDialog'
import type {
  RateRule,
  RateRuleCreateInput,
  RateRuleUpdateInput,
} from './types'

export function RateRulesManager({
  rules,
  isLoading,
  isMutating,
  error,
  onRetry,
  onCreate,
  onUpdate,
  onDisable,
}: {
  rules: RateRule[]
  isLoading: boolean
  isMutating: boolean
  error: string | null
  onRetry: () => void
  onCreate: (input: RateRuleCreateInput) => Promise<boolean>
  onUpdate: (id: string, input: RateRuleUpdateInput) => Promise<boolean>
  onDisable: (id: string) => Promise<boolean>
}) {
  const [name, setName] = useState('')
  const [adjustment, setAdjustment] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [editing, setEditing] = useState<RateRule | null>(null)
  const [editName, setEditName] = useState('')
  const [editAdjustment, setEditAdjustment] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [disableTarget, setDisableTarget] = useState<RateRule | null>(null)

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = parseSignedInteger(adjustment)
    if (!name.trim() || value === null) {
      setFormError('ルール名と整数の調整額を入力してください。')
      return
    }
    const succeeded = await onCreate({
      name_ja: name.trim(),
      description_ja: description.trim() || null,
      adjustment_type: 'fixed_amount',
      adjustment_value: value,
    })
    if (succeeded) {
      setName('')
      setAdjustment('')
      setDescription('')
      setFormError(null)
    }
  }

  function startEdit(rule: RateRule) {
    setEditing(rule)
    setEditName(rule.name_ja)
    setEditAdjustment(String(rule.adjustment_value))
    setEditDescription(rule.description_ja ?? '')
    setEditActive(rule.is_active)
    setFormError(null)
  }

  async function saveEdit() {
    if (!editing) return
    const value = parseSignedInteger(editAdjustment)
    if (!editName.trim() || value === null) {
      setFormError('ルール名と整数の調整額を入力してください。')
      return
    }
    if (
      await onUpdate(editing.id, {
        name_ja: editName.trim(),
        description_ja: editDescription.trim() || null,
        adjustment_value: value,
        is_active: editActive,
      })
    ) {
      setEditing(null)
      setFormError(null)
    }
  }

  async function confirmDisable() {
    if (!disableTarget) return
    if (await onDisable(disableTarget.id)) setDisableTarget(null)
  }

  return (
    <section aria-labelledby="rate-rules-heading">
      <p className="eyebrow">SPECIAL RATE RULES</p>
      <h2 id="rate-rules-heading" className="font-serif text-2xl">
        特別料金ルール
      </h2>
      <p className="mt-3 text-sm leading-7 text-muted">
        基本料金に加算・減算する金額をルールとして登録します。削除の代わりに無効化することで、過去の設定を安全に保持します。
      </p>

      <form
        onSubmit={create}
        className="mt-6 border border-line bg-surface p-6"
        noValidate
      >
        <h3 className="font-semibold">新しいルールを追加</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_.7fr_1.4fr_auto] md:items-end">
          <RuleField label="ルール名">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="admin-input"
              maxLength={80}
            />
          </RuleField>
          <RuleField label="調整額（円）">
            <input
              type="number"
              step="1"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              className="admin-input"
              placeholder="例：1000 / -500"
            />
          </RuleField>
          <RuleField label="説明（任意）">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="admin-input"
              maxLength={200}
              placeholder="例：土日・祝前日用"
            />
          </RuleField>
          <button
            type="submit"
            disabled={isMutating}
            className="min-h-11 bg-moss px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            追加
          </button>
        </div>
        {formError && (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {formError}
          </p>
        )}
      </form>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted" role="status">
          特別料金ルールを読み込んでいます…
        </p>
      ) : error ? (
        <div
          className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-800"
          role="alert"
        >
          {error}
          <button type="button" onClick={onRetry} className="ml-4 underline">
            再読み込み
          </button>
        </div>
      ) : rules.length === 0 ? (
        <div className="mt-6 border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          特別料金ルールはまだありません。
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#eceeea] text-xs text-muted">
              <tr>
                {['ルール名', '調整額', '説明', '状態', '操作'].map((label) => (
                  <th key={label} className="px-4 py-4 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rules.map((rule) => {
                const isEditing = editing?.id === rule.id
                return (
                  <tr key={rule.id}>
                    <td className="px-4 py-4">
                      {isEditing ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="admin-input"
                        />
                      ) : (
                        <span className="font-semibold">{rule.name_ja}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {isEditing ? (
                        <span className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editAdjustment}
                            onChange={(e) => setEditAdjustment(e.target.value)}
                            className="admin-input max-w-32"
                          />
                          円
                        </span>
                      ) : (
                        <span
                          className={
                            rule.adjustment_value < 0
                              ? 'text-blue-700'
                              : 'text-accent'
                          }
                        >
                          {formatAdjustment(
                            rule.adjustment_type,
                            rule.adjustment_value,
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {isEditing ? (
                        <input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="admin-input"
                        />
                      ) : (
                        <span className="text-muted">
                          {rule.description_ja ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {isEditing ? (
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                          />
                          有効
                        </label>
                      ) : (
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${rule.is_active ? 'bg-green-100 text-green-800' : 'bg-stone-200 text-stone-700'}`}
                        >
                          {rule.is_active ? '有効' : '無効'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEdit()}
                            disabled={isMutating}
                            className="min-h-10 bg-moss px-3 text-xs font-semibold text-white"
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="min-h-10 border border-line px-3 text-xs"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(rule)}
                            className="min-h-10 border border-line px-3 text-xs font-semibold"
                          >
                            編集
                          </button>
                          {rule.is_active && (
                            <button
                              type="button"
                              onClick={() => setDisableTarget(rule)}
                              className="min-h-10 border border-red-200 px-3 text-xs font-semibold text-red-700"
                            >
                              無効化
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {disableTarget && (
        <RateConfirmDialog
          title="特別料金ルールを無効にしますか？"
          description={`「${disableTarget.name_ja}」を無効にします。既存の日付適用は保持されますが、新しい適用には選択できなくなります。`}
          confirmLabel="無効にする"
          destructive
          isMutating={isMutating}
          onCancel={() => setDisableTarget(null)}
          onConfirm={() => void confirmDisable()}
        />
      )}
    </section>
  )
}

function RuleField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label>
      <span className="mb-2 block text-xs font-semibold text-muted">
        {label}
      </span>
      {children}
    </label>
  )
}
