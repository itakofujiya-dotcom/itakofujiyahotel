import { validateSupabaseConfiguration } from './config'

export const supabaseConfiguration = validateSupabaseConfiguration({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
})

export function reportSupabaseConfigurationError() {
  if (!import.meta.env.DEV || supabaseConfiguration.ok) return

  for (const name of supabaseConfiguration.missing)
    console.error(`[Supabase Config Error] Missing ${name}`)
}
