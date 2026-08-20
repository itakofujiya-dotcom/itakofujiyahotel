import { readFile } from 'node:fs/promises'
import { stdout } from 'node:process'
import { URL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

function parseEnvironmentFile(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        return [
          line.slice(0, separator).trim(),
          line
            .slice(separator + 1)
            .trim()
            .replace(/^(['"])(.*)\1$/, '$2'),
        ]
      }),
  )
}

const environment = parseEnvironmentFile(
  await readFile(new URL('../.env.local', import.meta.url), 'utf8'),
)
const url = environment.VITE_SUPABASE_URL
const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !publishableKey) {
  throw new Error('Supabase public environment variables are missing.')
}

const supabase = createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const [
  { data: roomTypes, error: roomTypesError },
  { data: rates, error: ratesError },
] = await Promise.all([
  supabase.from('room_types').select('id, code'),
  supabase
    .from('room_rates')
    .select('room_type_id, guest_count, price_per_person_yen'),
])

if (roomTypesError || ratesError) {
  throw new Error(
    `Rate data query failed: ${roomTypesError?.code ?? ratesError?.code ?? 'unknown'}`,
  )
}

const roomTypeIdByCode = Object.fromEntries(
  (roomTypes ?? []).map((roomType) => [roomType.code, roomType.id]),
)
const expected = {
  japanese: [13500, 8500, 8500, 8500],
  western: [15500, 9500, 9500, 9500],
}

if ((roomTypes ?? []).length !== 2 || (rates ?? []).length !== 8) {
  throw new Error(
    `Unexpected rate data count: room_types=${roomTypes?.length ?? 0}, room_rates=${rates?.length ?? 0}`,
  )
}

for (const [code, prices] of Object.entries(expected)) {
  const roomTypeId = roomTypeIdByCode[code]
  const actual = (rates ?? [])
    .filter((rate) => rate.room_type_id === roomTypeId)
    .sort((a, b) => a.guest_count - b.guest_count)
    .map((rate) => rate.price_per_person_yen)
  if (JSON.stringify(actual) !== JSON.stringify(prices)) {
    throw new Error(`Unexpected ${code} base-rate values.`)
  }
}

stdout.write('Supabase rate data check passed: 2 room types, 8 base rates.\n')
