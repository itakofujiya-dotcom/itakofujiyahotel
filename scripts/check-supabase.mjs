import { readFile } from 'node:fs/promises'
import { stdout } from 'node:process'
import { URL } from 'node:url'

const requiredNames = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']

function parseEnvironmentFile(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        const name = line.slice(0, separator).trim()
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, '$2')
        return [name, value]
      }),
  )
}

const localEnvironment = parseEnvironmentFile(
  await readFile(new URL('../.env.local', import.meta.url), 'utf8'),
)

for (const name of requiredNames) {
  if (!localEnvironment[name]) {
    throw new Error(
      `[Supabase check] Missing required environment variable: ${name}`,
    )
  }
}

const response = await globalThis.fetch(
  new URL('/auth/v1/health', localEnvironment.VITE_SUPABASE_URL),
  { headers: { apikey: localEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY } },
)

if (!response.ok) {
  throw new Error(
    `[Supabase check] Connection failed with HTTP status ${response.status}`,
  )
}

stdout.write('Supabase connection check passed.\n')
