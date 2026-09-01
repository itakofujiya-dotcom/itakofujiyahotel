import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { supabaseConfiguration } from './runtime-config'

// Only the browser-safe publishable key belongs in the frontend bundle.
// Secret and service-role keys must remain in trusted server environments.
export const supabase: SupabaseClient<Database> = supabaseConfiguration.ok
  ? createClient<Database>(
      supabaseConfiguration.config.url,
      supabaseConfiguration.config.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    )
  : createUnavailableSupabaseClient()

function createUnavailableSupabaseClient(): SupabaseClient<Database> {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('Supabase client is unavailable.')
      },
    },
  ) as SupabaseClient<Database>
}
