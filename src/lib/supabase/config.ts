export const supabaseEnvironmentVariableNames = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
] as const

export type SupabaseEnvironmentVariableName =
  (typeof supabaseEnvironmentVariableNames)[number]

export type SupabaseEnvironment = Partial<
  Record<SupabaseEnvironmentVariableName, string>
>

export type SupabaseConfigurationResult =
  | {
      ok: true
      config: {
        url: string
        publishableKey: string
      }
      missing: []
    }
  | {
      ok: false
      config: null
      missing: SupabaseEnvironmentVariableName[]
    }

export function validateSupabaseConfiguration(
  environment: SupabaseEnvironment,
): SupabaseConfigurationResult {
  const url = environment.VITE_SUPABASE_URL?.trim() ?? ''
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  const missing = supabaseEnvironmentVariableNames.filter(
    (name) => !environment[name]?.trim(),
  )

  if (missing.length > 0) return { ok: false, config: null, missing }

  return {
    ok: true,
    config: { url, publishableKey },
    missing: [],
  }
}
