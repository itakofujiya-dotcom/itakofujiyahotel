import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { PublicLayout } from '../layouts/PublicLayout'
import { AdminLayout } from '../layouts/AdminLayout'
import { HomePage } from '../pages/public/HomePage'
import { RoomsPage } from '../pages/public/RoomsPage'
import { FacilitiesPage } from '../pages/public/FacilitiesPage'
import { AccessPage } from '../pages/public/AccessPage'
import { SightseeingPage } from '../pages/public/SightseeingPage'
import { FaqPage } from '../pages/public/FaqPage'
import { BookingPage } from '../pages/public/BookingPage'
import { InfoPage } from '../pages/public/InfoPage'
import { LoginPage } from '../pages/admin/LoginPage'
import { DashboardPage } from '../pages/admin/DashboardPage'
import {
  ReservationsAdminPage,
  ReservationDetailPage,
} from '../pages/admin/ReservationsAdminPage'
import { RoomsAdminPage } from '../pages/admin/RoomsAdminPage'
import { RatesAdminPage } from '../pages/admin/RatesAdminPage'
import { SettingsAdminPage } from '../pages/admin/SettingsAdminPage'

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
      { path: '/booking/confirm', element: <InfoPage kind="confirm" /> },
      { path: '/reservation', element: <InfoPage kind="reservation" /> },
      { path: '/policies', element: <InfoPage kind="policies" /> },
      { path: '*', element: <InfoPage kind="policies" /> },
    ],
  },
  { path: '/admin/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'reservations', element: <ReservationsAdminPage /> },
      { path: 'reservations/:id', element: <ReservationDetailPage /> },
      { path: 'rooms', element: <RoomsAdminPage /> },
      { path: 'rates', element: <RatesAdminPage /> },
      { path: 'settings', element: <SettingsAdminPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
