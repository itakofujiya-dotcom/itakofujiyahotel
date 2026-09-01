import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { PublicLayout } from '../layouts/PublicLayout'
import { AdminLayout } from '../layouts/AdminLayout'
import { HomePage } from '../pages/public/HomePage'
import { RoomsPage } from '../pages/public/RoomsPage'
import { FacilitiesPage } from '../pages/public/FacilitiesPage'
import { AccessPage } from '../pages/public/AccessPage'
import { SightseeingPage } from '../pages/public/SightseeingPage'
import { FaqPage } from '../pages/public/FaqPage'
import { BookingPage } from '../pages/public/BookingPage'
import { BookingDetailsPage } from '../pages/public/BookingDetailsPage'
import { BookingConfirmPage } from '../pages/public/BookingConfirmPage'
import { BookingCompletePage } from '../pages/public/BookingCompletePage'
import { PolicyPage } from '../pages/public/PolicyPage'
import { ReservationLookupPage } from '../pages/public/ReservationLookupPage'
import { LoginPage } from '../pages/admin/LoginPage'
import { ForgotPasswordPage } from '../pages/admin/ForgotPasswordPage'
import { ResetPasswordPage } from '../pages/admin/ResetPasswordPage'
import { DashboardPage } from '../pages/admin/DashboardPage'
import { ReservationsAdminPage } from '../pages/admin/ReservationsAdminPage'
import { ReservationDetailPage } from '../pages/admin/ReservationDetailPage'
import { NewReservationAdminPage } from '../pages/admin/NewReservationAdminPage'
import { RoomsAdminPage } from '../pages/admin/RoomsAdminPage'
import { RatesAdminPage } from '../pages/admin/RatesAdminPage'
import { InventoryAdminPage } from '../pages/admin/InventoryAdminPage'
import { SettingsAdminPage } from '../pages/admin/SettingsAdminPage'
import { CustomersAdminPage } from '../pages/admin/CustomersAdminPage'
import { CustomerDetailPage } from '../pages/admin/CustomerDetailPage'
import { SalesAdminPage } from '../pages/admin/SalesAdminPage'
import { AdminAuthProvider } from '../features/auth/AdminAuthProvider'
import { AdminProtectedRoute } from '../features/auth/AdminProtectedRoute'
import { AdminLocaleProvider } from '../i18n/AdminLocaleProvider'
import { SiteLocaleProvider } from '../i18n/SiteLocaleProvider'

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/rooms', element: <RoomsPage /> },
      { path: '/facilities', element: <FacilitiesPage /> },
      { path: '/access', element: <AccessPage /> },
      { path: '/sightseeing', element: <SightseeingPage /> },
      { path: '/faq', element: <FaqPage /> },
      { path: '/booking', element: <BookingPage /> },
      { path: '/booking/details', element: <BookingDetailsPage /> },
      { path: '/booking/confirm', element: <BookingConfirmPage /> },
      { path: '/booking/complete', element: <BookingCompletePage /> },
      { path: '/reservation', element: <ReservationLookupPage /> },
      { path: '/terms', element: <PolicyPage kind="terms" /> },
      { path: '/privacy', element: <PolicyPage kind="privacy" /> },
      {
        path: '/cancellation-policy',
        element: <PolicyPage kind="cancellation" />,
      },
      { path: '/policies', element: <Navigate to="/terms" replace /> },
      { path: '*', element: <Navigate to="/terms" replace /> },
    ],
  },
  { path: '/admin/login', element: <LoginPage /> },
  { path: '/admin/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/admin/reset-password', element: <ResetPasswordPage /> },
  {
    element: <AdminProtectedRoute />,
    children: [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'reservations', element: <ReservationsAdminPage /> },
          { path: 'reservations/new', element: <NewReservationAdminPage /> },
          { path: 'reservations/:id', element: <ReservationDetailPage /> },
          { path: 'customers', element: <CustomersAdminPage /> },
          { path: 'customers/:id', element: <CustomerDetailPage /> },
          { path: 'rooms', element: <RoomsAdminPage /> },
          { path: 'inventory', element: <InventoryAdminPage /> },
          { path: 'rates', element: <RatesAdminPage /> },
          { path: 'sales', element: <SalesAdminPage /> },
          { path: 'settings', element: <SettingsAdminPage /> },
        ],
      },
    ],
  },
])

export function App() {
  return (
    <SiteLocaleProvider>
      <AdminLocaleProvider>
        <AdminAuthProvider>
          <RouterProvider router={router} />
        </AdminAuthProvider>
      </AdminLocaleProvider>
    </SiteLocaleProvider>
  )
}
