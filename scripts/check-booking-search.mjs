import { readFile } from 'node:fs/promises'
import { stdout } from 'node:process'
import { URL } from 'node:url'
import { addDays, format, parseISO } from 'date-fns'
import { createClient } from '@supabase/supabase-js'

const environment = Object.fromEntries(
  (await readFile(new URL('../.env.local', import.meta.url), 'utf8'))
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

const url = environment.VITE_SUPABASE_URL
const key = environment.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key)
  throw new Error('Supabase public environment variables are missing.')

const todayInJapan = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())
const checkIn = format(addDays(parseISO(todayInJapan), 1), 'yyyy-MM-dd')
const checkOut = format(addDays(parseISO(todayInJapan), 2), 'yyyy-MM-dd')
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data, error } = await supabase.rpc('search_available_room_types', {
  p_check_in: checkIn,
  p_check_out: checkOut,
  p_adults: 2,
  p_paid_children: 0,
  p_free_preschool_children: 0,
  p_room_count: 1,
})

if (error) throw new Error(`Booking search RPC failed: ${error.code}`)
if (!Array.isArray(data) || data.length !== 2)
  throw new Error(
    `Expected two public room-type results, received ${data?.length ?? 0}.`,
  )

const forbiddenKeys = [
  'guest_name',
  'email',
  'telephone',
  'reservation_number',
  'room_number',
]
for (const row of data) {
  if (forbiddenKeys.some((keyName) => keyName in row))
    throw new Error('Booking search RPC exposed a forbidden field.')
  if (!Array.isArray(row.nightly_prices) || row.nightly_prices.length !== 1)
    throw new Error('Booking search RPC returned invalid nightly prices.')
}

stdout.write(
  `Booking search RPC check passed for ${checkIn}: 2 room types, no private fields.\n`,
)
