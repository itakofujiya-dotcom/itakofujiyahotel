import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, startOfMonth } from 'date-fns'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import { InventoryCalendar } from '../../features/admin-inventory/InventoryCalendar'
import {
  clearInventoryDateSelection,
  getExistingInventoryKeys,
  getInventorySelectionDrafts,
  getInventorySummaries,
  validateInventoryDrafts,
} from '../../features/admin-inventory/inventory-helpers'
import type { InventoryRoomTypeSummary } from '../../features/admin-inventory/types'
import { useAdminInventory } from '../../features/admin-inventory/useAdminInventory'
import { RateConfirmDialog } from '../../features/admin-rates/RateConfirmDialog'

type QuantityValue = { roomTypeId: string; quantity: number }
type ConfirmRequest =
  | { type: 'save'; dates: string[]; values: QuantityValue[] }
  | {
      type: 'reset'
      dates: string[]
      roomTypeIds: string[]
      expectedKeys: string[]
    }
  | null

export function InventoryAdminPage() {
  const today = new Date()
  const [month, setMonth] = useState(startOfMonth(today))
  const [selectedDates, setSelectedDates] = useState<Set<string>>(
    () => new Set([format(today, 'yyyy-MM-dd')]),
  )
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [validationError, setValidationError] = useState<string | null>(null)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest>(null)
  const {
    capacities,
    inventory,
    availability,
    maxBookingDays,
    isLoading,
    isMutating,
    error,
    feedback,
    loadInventory,
    saveDates,
    resetDates,
  } = useAdminInventory(month)

  const selectedDateList = useMemo(
    () => [...selectedDates].sort(),
    [selectedDates],
  )
  const selectionKey = selectedDateList.join(',')
  const singleDate = selectedDateList.length === 1 ? selectedDateList[0] : null
  const singleSummaries = useMemo(
    () =>
      singleDate
        ? getInventorySummaries(capacities, inventory, singleDate)
        : [],
    [capacities, inventory, singleDate],
  )

  useEffect(() => {
    setDrafts(
      getInventorySelectionDrafts(capacities, inventory, selectedDateList),
    )
    setValidationError(null)
    // selectionKey represents the complete selected-date set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacities, inventory, selectionKey])

  const formSummaries: InventoryRoomTypeSummary[] = capacities.map(
    (capacity) => {
      const single = singleSummaries.find(
        (summary) => summary.roomTypeId === capacity.roomTypeId,
      )
      return (
        single ?? {
          ...capacity,
          sellableQuantity: capacity.activeRooms,
          isDefault: true,
          inventoryId: null,
        }
      )
    },
  )
  const existingKeys = getExistingInventoryKeys(
    inventory,
    selectedDates,
    new Set(capacities.map((capacity) => capacity.roomTypeId)),
  )

  function requestSave() {
    const values = validateInventoryDrafts(formSummaries, drafts)
    if (selectedDateList.length === 0) {
      setValidationError('適用する日付を選択してください。')
      return
    }
    if (!values) {
      setValidationError(
        '販売可能数は0以上、現在利用可能な客室数以下の整数で入力してください。',
      )
      return
    }
    setConfirmRequest({ type: 'save', dates: selectedDateList, values })
  }

  async function confirmSave() {
    if (confirmRequest?.type !== 'save') return
    if (await saveDates(confirmRequest.dates, confirmRequest.values))
      setConfirmRequest(null)
  }

  async function confirmReset() {
    if (confirmRequest?.type !== 'reset') return
    if (
      await resetDates(
        confirmRequest.dates,
        confirmRequest.roomTypeIds,
        confirmRequest.expectedKeys,
      )
    )
      setConfirmRequest(null)
  }

  function changeMonth(nextMonth: Date) {
    setMonth(startOfMonth(nextMonth))
    setSelectedDates(clearInventoryDateSelection())
    setConfirmRequest(null)
    setValidationError(null)
  }

  return (
    <>
      <AdminPageHeader
        title="在庫管理"
        description="日付別のオンライン販売可能数を設定します。"
      />

      {isLoading ? (
        <InventoryLoading />
      ) : error ? (
        <InventoryError message={error} onRetry={() => void loadInventory()} />
      ) : (
        <div className="space-y-8">
          {feedback && <FeedbackBanner feedback={feedback} />}

          <InventoryCalendar
            month={month}
            selectedDates={selectedDates}
            capacities={capacities}
            inventory={inventory}
            availability={availability}
            maxBookingDays={maxBookingDays}
            onMonthChange={changeMonth}
            onSelectionChange={setSelectedDates}
          />

          <section className="border border-line bg-surface p-6 sm:p-8">
            <p className="eyebrow">SELECTED DATES</p>
            <h2 className="mt-2 font-serif text-2xl">
              {singleDate
                ? format(parseISO(singleDate), 'yyyy年M月d日')
                : selectedDateList.length > 1
                  ? `選択した日付: ${selectedDateList.length}日`
                  : '日付を選択してください'}
            </h2>
            <p className="mt-3 text-sm text-muted">
              登録客室数と現在 active の客室数は別に表示しています。
            </p>

            {selectedDateList.length > 0 ? (
              <>
                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  {formSummaries.map((summary) => {
                    const hasMixedValues =
                      selectedDateList.length > 1 &&
                      drafts[summary.roomTypeId] === ''
                    return (
                      <div
                        key={summary.roomTypeId}
                        className="border border-line bg-background p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-serif text-xl">
                              {summary.nameJa}
                            </h3>
                            <p className="mt-2 text-xs leading-6 text-muted">
                              登録客室数: {summary.totalRooms}室
                              <br />
                              現在利用可能: {summary.activeRooms}室
                            </p>
                          </div>
                          {singleDate && (
                            <span
                              className={`rounded px-2 py-1 text-[10px] font-semibold ${summary.isDefault ? 'bg-stone-200 text-muted' : 'bg-green-100 text-green-800'}`}
                            >
                              {summary.isDefault ? 'デフォルト' : '設定済み'}
                            </span>
                          )}
                        </div>
                        <label className="mt-5 block">
                          <span className="mb-2 block text-xs font-semibold text-muted">
                            販売可能数
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={summary.activeRooms}
                              step={1}
                              inputMode="numeric"
                              value={drafts[summary.roomTypeId] ?? ''}
                              placeholder={
                                hasMixedValues ? '複数の設定があります' : ''
                              }
                              onChange={(event) => {
                                setDrafts((current) => ({
                                  ...current,
                                  [summary.roomTypeId]: event.target.value,
                                }))
                                setValidationError(null)
                              }}
                              className="admin-input min-w-48 max-w-64"
                              aria-label={`${summary.nameJa}の販売可能数`}
                            />
                            <span className="text-sm text-muted">室</span>
                          </div>
                        </label>
                        {hasMixedValues ? (
                          <p className="mt-3 text-xs font-semibold text-accent">
                            複数の設定があります。新しい値を入力してください。
                          </p>
                        ) : (
                          <p className="mt-3 text-xs text-muted">
                            入力範囲: 0〜{summary.activeRooms}室
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-5 border-l-4 border-accent bg-[#eee7d9] p-4 text-sm leading-7">
                  0室に設定すると、この日はオンライン販売されません。未設定の場合は現在
                  active の客室数がデフォルトとして使用されます。
                </div>
              </>
            ) : (
              <p className="mt-6 border border-line bg-background p-6 text-sm text-muted">
                カレンダーから設定する日付を選択してください。
              </p>
            )}

            {validationError && (
              <p className="mt-4 text-sm text-red-700" role="alert">
                {validationError}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={requestSave}
                disabled={isMutating || selectedDateList.length === 0}
                className="min-h-11 bg-moss px-6 text-sm font-semibold text-white disabled:opacity-45"
              >
                {singleDate ? '保存' : '選択した日付に適用'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setConfirmRequest({
                    type: 'reset',
                    dates: selectedDateList,
                    roomTypeIds: capacities.map(
                      (capacity) => capacity.roomTypeId,
                    ),
                    expectedKeys: existingKeys,
                  })
                }
                disabled={isMutating || existingKeys.length === 0}
                className="min-h-11 border border-line px-6 text-sm font-semibold disabled:opacity-45"
              >
                {singleDate
                  ? 'デフォルトに戻す'
                  : '選択した日付をデフォルトに戻す'}
              </button>
            </div>
          </section>
        </div>
      )}

      {confirmRequest?.type === 'save' && (
        <RateConfirmDialog
          title={
            confirmRequest.dates.length === 1
              ? `${format(parseISO(confirmRequest.dates[0]), 'yyyy年M月d日')}の販売可能数を変更しますか？`
              : '選択した日付の販売可能数を変更しますか？'
          }
          description={buildSaveDescription(
            confirmRequest.dates,
            confirmRequest.values,
            formSummaries,
          )}
          isMutating={isMutating}
          onCancel={() => setConfirmRequest(null)}
          onConfirm={() => void confirmSave()}
        />
      )}

      {confirmRequest?.type === 'reset' && (
        <RateConfirmDialog
          title={
            confirmRequest.dates.length === 1
              ? `${format(parseISO(confirmRequest.dates[0]), 'yyyy年M月d日')}の販売設定を初期状態に戻しますか？`
              : '選択した日付をデフォルトに戻しますか？'
          }
          description={`${confirmRequest.dates.length > 1 ? `対象: ${confirmRequest.dates.length}日\n\n` : ''}設定した在庫数を削除し、現在利用可能な客室数が使用されます。`}
          confirmLabel="デフォルトに戻す"
          isMutating={isMutating}
          onCancel={() => setConfirmRequest(null)}
          onConfirm={() => void confirmReset()}
        />
      )}
    </>
  )
}

function buildSaveDescription(
  dates: string[],
  values: QuantityValue[],
  summaries: InventoryRoomTypeSummary[],
): string {
  const quantities = values
    .map((value) => {
      const summary = summaries.find(
        (item) => item.roomTypeId === value.roomTypeId,
      )!
      return `${summary.nameJa}\n${dates.length === 1 ? `${summary.sellableQuantity}室 → ` : ''}${value.quantity}室`
    })
    .join('\n\n')
  return dates.length === 1
    ? quantities
    : `対象: ${dates.length}日\n\n${quantities}\n\n既存の設定がある日付は上書きされます。`
}

function FeedbackBanner({
  feedback,
}: {
  feedback: { type: 'success' | 'error'; message: string }
}) {
  return (
    <div
      role={feedback.type === 'error' ? 'alert' : 'status'}
      className={`border p-4 text-sm ${feedback.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}
    >
      {feedback.message}
    </div>
  )
}

function InventoryLoading() {
  return (
    <div
      className="border border-line bg-surface p-12 text-center"
      role="status"
    >
      <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-line border-t-moss" />
      <p className="mt-4 text-sm text-muted">在庫情報を読み込んでいます...</p>
    </div>
  )
}

function InventoryError({
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
      <p className="text-sm text-red-800">{message}</p>
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
