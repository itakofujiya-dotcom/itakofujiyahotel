import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AdminPageHeader } from '../../components/admin/AdminPageHeader'
import {
  customerPageSize,
  fetchCustomers,
} from '../../features/admin-customers/admin-customers-api'
import {
  formatCustomerDate,
  getCustomerVisitLabel,
} from '../../features/admin-customers/customer-helpers'
import type {
  CustomerSort,
  CustomerSummary,
} from '../../features/admin-customers/types'

export function CustomersAdminPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<CustomerSort>('recent')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchCustomers({ search, sort, page })
      setCustomers(result.customers)
      setTotalCount(result.totalCount)
    } catch {
      setError('顧客情報を取得できませんでした。')
    } finally {
      setIsLoading(false)
    }
  }, [page, search, sort])

  useEffect(() => {
    void load()
  }, [load])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setSearch(searchDraft.trim())
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / customerPageSize))

  return (
    <>
      <AdminPageHeader
        title="顧客管理"
        description="顧客情報と宿泊履歴、再訪状況を確認します。"
      />

      <div className="mb-6 flex flex-col gap-4 border border-line bg-surface p-5 lg:flex-row lg:items-end lg:justify-between">
        <form
          onSubmit={submitSearch}
          className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-2xl"
        >
          <label className="flex-1">
            <span className="mb-2 block text-xs font-semibold text-muted">
              氏名・電話番号
            </span>
            <input
              className="admin-input"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="山田太郎 / 090-1234"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 self-end bg-moss px-6 text-sm font-semibold text-white"
          >
            検索
          </button>
        </form>
        <label className="w-full lg:w-56">
          <span className="mb-2 block text-xs font-semibold text-muted">
            並び順
          </span>
          <select
            className="admin-input"
            value={sort}
            onChange={(event) => {
              setPage(1)
              setSort(event.target.value as CustomerSort)
            }}
          >
            <option value="recent">最近の訪問順</option>
            <option value="visits">訪問回数が多い順</option>
            <option value="name">氏名順</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <State text="顧客情報を読み込んでいます..." />
      ) : error ? (
        <State text={error} />
      ) : customers.length === 0 ? (
        <State text="条件に一致する顧客はいません。" />
      ) : (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="border-b border-line bg-background text-xs text-muted">
              <tr>
                <th className="px-5 py-4">顧客</th>
                <th className="px-5 py-4">電話番号</th>
                <th className="px-5 py-4">訪問回数</th>
                <th className="px-5 py-4">初回訪問</th>
                <th className="px-5 py-4">最近の訪問</th>
                <th className="px-5 py-4">総宿泊数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-background">
                  <td className="p-0">
                    <Link
                      to={`/admin/customers/${customer.id}`}
                      className="block px-5 py-4 font-semibold text-ink"
                    >
                      {customer.name}
                      <span className="mt-1 block text-xs font-normal text-accent">
                        {getCustomerVisitLabel(customer.completedStays)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-5 py-4">{customer.phone}</td>
                  <td className="px-5 py-4">{customer.completedStays}回</td>
                  <td className="px-5 py-4">
                    {formatCustomerDate(customer.firstVisit)}
                  </td>
                  <td className="px-5 py-4">
                    {formatCustomerDate(customer.recentVisit)}
                  </td>
                  <td className="px-5 py-4">{customer.totalNights}泊</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && totalCount > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            全{totalCount}件 · {page}/{totalPages}ページ
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="min-h-10 border border-line bg-surface px-4 disabled:opacity-40"
            >
              前へ
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="min-h-10 border border-line bg-surface px-4 disabled:opacity-40"
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function State({ text }: { text: string }) {
  return (
    <div className="border border-line bg-surface p-12 text-center text-sm text-muted">
      {text}
    </div>
  )
}
