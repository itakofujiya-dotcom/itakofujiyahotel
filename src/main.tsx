import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  reportSupabaseConfigurationError,
  supabaseConfiguration,
} from './lib/supabase/runtime-config'
import { SystemConfigErrorPage } from './pages/system/SystemConfigErrorPage'
import './styles/global.css'

const root = createRoot(document.getElementById('root')!)

async function startApplication() {
  if (!supabaseConfiguration.ok) {
    reportSupabaseConfigurationError()
    root.render(
      <StrictMode>
        <SystemConfigErrorPage />
      </StrictMode>,
    )
    return
  }

  const { App } = await import('./app/App')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void startApplication()
