import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { PublicLayout } from './layouts/PublicLayout'
import { NotFoundPage } from './NotFoundPage'
import { RouteError } from './RouteError'
import { withSuspense } from './withSuspense'

const HomePage = lazy(() => import('@/features/home/HomePage'))

export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: withSuspense(<HomePage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
