import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router'
import { Toaster } from 'sonner'

import { ErrorNotice } from '@/components/ErrorNotice'
import { AppShell } from '@/components/layout/AppShell'
import { FullPageLoader } from '@/components/layout/FullPageLoader'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ApiError } from '@/lib/api/client'
import { useSetupStatus } from '@/lib/api/hooks'
import { createQueryClient } from '@/lib/query-client'

const DashboardPage = React.lazy(() => import('@/features/dashboard/DashboardPage'))
const CreatePage = React.lazy(() => import('@/features/create/CreatePage'))
const GenerationPage = React.lazy(() => import('@/features/results/GenerationPage'))
const LibraryPage = React.lazy(() => import('@/features/library/LibraryPage'))
const HistoryPage = React.lazy(() => import('@/features/history/HistoryPage'))
const BrandsPage = React.lazy(() => import('@/features/brands/BrandsPage'))
const BrandEditorPage = React.lazy(() => import('@/features/brands/BrandEditorPage'))
const SettingsPage = React.lazy(() => import('@/features/settings/SettingsPage'))
const SetupWizard = React.lazy(() => import('@/features/setup/SetupWizard'))
const LoginPage = React.lazy(() => import('@/features/setup/LoginPage'))

/** First-launch routing: no account → setup wizard; signed out → sign in; not onboarded → wizard. */
function AppGate() {
  const { data: status, error, refetch, isPending } = useSetupStatus()
  const location = useLocation()
  if (isPending) return <FullPageLoader />
  if (error || !status)
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorNotice error={error} onRetry={() => void refetch()} />
      </div>
    )
  if (!status.authenticated) {
    return (
      <Navigate to={status.needs_account ? '/setup' : '/login'} replace state={{ from: location.pathname }} />
    )
  }
  if (!status.onboarding_completed) return <Navigate to="/setup" replace />
  return <AppShell />
}

function Suspended() {
  return (
    <React.Suspense fallback={<FullPageLoader />}>
      <Outlet />
    </React.Suspense>
  )
}

function RouteError() {
  return (
    <div className="mx-auto max-w-md p-8">
      <ErrorNotice
        error={
          new ApiError(500, {
            code: 'ui_error',
            title: 'This page hit a problem',
            message: 'Reload the page to continue. Your saved content is safe.',
            retryable: true,
            details: {},
          })
        }
        onRetry={() => window.location.reload()}
      />
    </div>
  )
}

const routes = [
  {
    element: <Suspended />,
    errorElement: <RouteError />,
    children: [
      { path: '/setup', element: <SetupWizard /> },
      { path: '/login', element: <LoginPage /> },
      {
        element: <AppGate />,
        children: [
          {
            element: <Suspended />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'create', element: <Navigate to="/create/reel" replace /> },
              { path: 'create/:type', element: <CreatePage /> },
              { path: 'generations/:id', element: <GenerationPage /> },
              { path: 'library', element: <LibraryPage /> },
              { path: 'history', element: <HistoryPage /> },
              { path: 'brands', element: <BrandsPage /> },
              { path: 'brands/new', element: <BrandEditorPage /> },
              { path: 'brands/:id', element: <BrandEditorPage /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: 'settings/:tab', element: <SettingsPage /> },
              { path: '*', element: <Navigate to="/" replace /> },
            ],
          },
        ],
      },
    ],
  },
]

export default function App({ queryClient }: { queryClient?: QueryClient }) {
  const [client] = React.useState(() => queryClient ?? createQueryClient())
  const [router] = React.useState(() => createBrowserRouter(routes))
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: { toast: '!rounded-lg !border-line !bg-surface !text-ink !shadow-pop' },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
