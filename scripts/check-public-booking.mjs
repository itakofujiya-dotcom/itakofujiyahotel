import { randomUUID } from 'node:crypto'
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

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())
const checkIn = format(addDays(parseISO(today), 1), 'yyyy-MM-dd')
const checkOut = format(addDays(parseISO(today), 2), 'yyyy-MM-dd')
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const search = await client.rpc('search_available_room_types', {
  p_check_in: checkIn,
  p_check_out: checkOut,
  p_adults: 2,
  p_paid_children: 0,
  p_free_preschool_children: 0,
  p_room_count: 1,
})
if (search.error) throw new Error(`Search failed: ${search.error.code}`)
const room = search.data.find((row) => row.is_available)
if (!room) throw new Error('No available room type for rollback verification.')

const invalid = await client.rpc('create_public_reservation', {
  p_booking_request_id: randomUUID(),
  p_check_in: checkOut,
  p_check_out: checkIn,
  p_adults: 2,
  p_paid_children: 0,
  p_free_preschool_children: 0,
  p_room_count: 1,
  p_room_type_id: room.room_type_id,
  p_name: 'TEST PUBLIC BOOKING',
  p_name_kana_or_roman: 'TEST PUBLIC BOOKING',
  p_telephone: '+81-00-0000-0000',
  p_email: 'test-public-booking@example.invalid',
  p_expected_check_in_time: '16:00',
  p_guest_note: '',
  p_expected_total_yen: room.estimated_total_yen,
})
if (invalid.error || invalid.data?.code !== 'INVALID_BOOKING')
  throw new Error('Invalid-date verification failed.')

const priceChanged = await client.rpc('create_public_reservation', {
  p_booking_request_id: randomUUID(),
  p_check_in: checkIn,
  p_check_out: checkOut,
  p_adults: 2,
  p_paid_children: 0,
  p_free_preschool_children: 0,
  p_room_count: 1,
  p_room_type_id: room.room_type_id,
  p_name: 'TEST PUBLIC BOOKING',
  p_name_kana_or_roman: 'TEST PUBLIC BOOKING',
  p_telephone: '+81-00-0000-0000',
  p_email: 'test-public-booking@example.invalid',
  p_expected_check_in_time: '16:00',
  p_guest_note: '',
  p_expected_total_yen: room.estimated_total_yen + 1,
})
if (priceChanged.error || priceChanged.data?.code !== 'PRICE_CHANGED')
  throw new Error('Price-change verification failed.')

stdout.write(
  `Anonymous public booking no-write check passed for ${checkIn}: validation and price-change response.\n`,
)
