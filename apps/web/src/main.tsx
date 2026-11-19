import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { AppProviders } from './app/AppProviders'
import { router } from './app/router'
import { z } from 'zod'
import { initMonitoring } from './lib/monitoring'
import './index.css'

// Zod 4 probes `new Function` for faster parsers: the CSP forbids eval, so opt out (DEC-031).
z.config({ jitless: true })
void initMonitoring()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
