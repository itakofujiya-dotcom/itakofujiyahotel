import assert from 'node:assert/strict'
import test from 'node:test'
import { validateSupabaseConfiguration } from '../src/lib/supabase/config.ts'

const validEnvironment = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
}

test('accepts the existing Supabase public environment variables', () => {
  assert.deepEqual(validateSupabaseConfiguration(validEnvironment), {
    ok: true,
    config: {
      url: validEnvironment.VITE_SUPABASE_URL,
      publishableKey: validEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    missing: [],
  })
})

test('reports a missing Supabase URL', () => {
  assert.deepEqual(
    validateSupabaseConfiguration({
      VITE_SUPABASE_PUBLISHABLE_KEY:
        validEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY,
    }),
    {
      ok: false,
      config: null,
      missing: ['VITE_SUPABASE_URL'],
    },
  )
})

test('reports a missing Supabase publishable key', () => {
  assert.deepEqual(
    validateSupabaseConfiguration({
      VITE_SUPABASE_URL: validEnvironment.VITE_SUPABASE_URL,
    }),
    {
      ok: false,
      config: null,
      missing: ['VITE_SUPABASE_PUBLISHABLE_KEY'],
    },
  )
})

test('reports both missing variables', () => {
  assert.deepEqual(validateSupabaseConfiguration({}), {
    ok: false,
    config: null,
    missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'],
  })
})

test('treats empty and whitespace-only values as missing', () => {
  assert.deepEqual(
    validateSupabaseConfiguration({
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_PUBLISHABLE_KEY: '   ',
    }),
    {
      ok: false,
      config: null,
      missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'],
    },
  )
})
