import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAdminAuth } from './use-admin-auth'
import { resolveAdminRouteAccess } from './authorization'

export function AdminProtectedRoute() {
  const location = useLocation()
  const { isLoading, isAuthenticated, adminProfile } = useAdminAuth()
  const access = resolveAdminRouteAccess({
    isLoading,
    isAuthenticated,
    adminProfile,
  })

  if (access === 'loading') {
    return <AdminAuthLoading message="ログイン状態を確認しています…" />
  }

  if (access !== 'authorized') {
    return (
      <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
    )
  }

  return <Outlet />
}

export function AdminAuthLoading({ message }: { message: string }) {
  return (
    <main
      className="grid min-h-screen place-items-center bg-[#e9ece8] p-5"
      data-admin-i18n-root
    >
      <div className="text-center" role="status" aria-live="polite">
        <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-line border-t-moss" />
        <p className="mt-4 text-sm text-muted">{message}</p>
      </div>
    </main>
  )
}
