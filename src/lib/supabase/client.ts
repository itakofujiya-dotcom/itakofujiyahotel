import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'

function requirePublicEnvironmentVariable(
  name: string,
  value: string | undefined,
): string {
  if (!value?.trim()) {
    throw new Error(
      `[Supabase] Missing required public environment variable: ${name}`,
    )
  }

  return value
}

const supabaseUrl = requirePublicEnvironmentVariable(
  'VITE_SUPABASE_URL',
  import.meta.env.VITE_SUPABASE_URL,
)
const supabasePublishableKey = requirePublicEnvironmentVariable(
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

// Only the browser-safe publishable key belongs in the frontend bundle.
// Secret and service-role keys must remain in trusted server environments.
export const supabase = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: { persistSession: true, autoRefreshToken: true },
  },
)
