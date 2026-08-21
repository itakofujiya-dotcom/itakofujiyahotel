import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'
import {
  areAdminHotelSettingsEqual,
  normalizeAdminHotelSettingsForm,
  toAdminHotelSettingsForm,
  validateAdminHotelSettings,
} from '../src/features/admin-settings/admin-settings-helpers.ts'

const validForm = {
  hotelNameJa: '潮来富士屋ホテル',
  hotelNameEn: 'ITAKO FUJIYA HOTEL',
  postalCode: '311-2424',
  addressJa: '茨城県潮来市潮来102',
  telephone: '0299-94-2662',
  fax: '0299-94-2663',
  email: 'info@example.com',
  checkInTime: '15:00',
  checkOutTime: '10:00',
  frontDeskOpen: '15:00',
  frontDeskClose: '22:00',
}

test('maps persisted settings into editable time and nullable text fields', () => {
  assert.deepEqual(
    toAdminHotelSettingsForm({
      id: 'settings',
      hotel_name_ja: validForm.hotelNameJa,
      hotel_name_en: null,
      postal_code: validForm.postalCode,
      address_ja: validForm.addressJa,
      telephone: validForm.telephone,
      fax: null,
      email: null,
      check_in_time: '15:00:00',
      check_out_time: '10:00:00',
      front_desk_open: '15:00:00',
      front_desk_close: '22:00:00',
      updated_at: '2026-08-21T00:00:00Z',
    }),
    {
      ...validForm,
      hotelNameEn: '',
      fax: '',
      email: '',
    },
  )
})

test('accepts an optional email and rejects an invalid configured email', () => {
  assert.equal(validateAdminHotelSettings(validForm), null)
  assert.equal(validateAdminHotelSettings({ ...validForm, email: '' }), null)
  assert.match(
    validateAdminHotelSettings({ ...validForm, email: 'invalid' }) ?? '',
    /メールアドレス/,
  )
})

test('validates required values and front desk time order', () => {
  assert.match(
    validateAdminHotelSettings({ ...validForm, hotelNameJa: ' ' }) ?? '',
    /ホテル名/,
  )
  assert.match(
    validateAdminHotelSettings({
      ...validForm,
      frontDeskOpen: '22:00',
      frontDeskClose: '15:00',
    }) ?? '',
    /終了時間/,
  )
})

test('normalizes persisted text and detects meaningful changes', () => {
  const padded = {
    ...validForm,
    hotelNameJa: ` ${validForm.hotelNameJa} `,
    email: ' INFO@EXAMPLE.COM ',
  }
  assert.equal(
    normalizeAdminHotelSettingsForm(padded).email,
    'info@example.com',
  )
  assert.equal(
    areAdminHotelSettingsEqual(padded, {
      ...validForm,
      email: 'info@example.com',
    }),
    true,
  )
  assert.equal(
    areAdminHotelSettingsEqual(validForm, {
      ...validForm,
      telephone: '0299-00-0000',
    }),
    false,
  )
})

test('migration keeps email private while exposing only safe public settings', async () => {
  const sql = await readFile(
    new URL(
      '../supabase/migrations/202608210008_admin_hotel_settings.sql',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(sql, /drop policy if exists "public read hotel settings"/)
  assert.match(sql, /revoke select on public\.hotel_settings from anon/)
  assert.match(sql, /get_public_hotel_information/)
  assert.match(sql, /grant execute[\s\S]+to anon, authenticated/)
  const publicReturnColumns = sql.slice(
    sql.indexOf('returns table'),
    sql.indexOf('language sql'),
  )
  assert.doesNotMatch(publicReturnColumns, /email/)
})

test('admin settings update targets the loaded row and verifies the returned row', async () => {
  const api = await readFile(
    new URL(
      '../src/features/admin-settings/admin-settings-api.ts',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(api, /\.update\(\{/)
  assert.match(api, /\.eq\('id', id\)/)
  assert.match(api, /\.select\(settingsSelect\)/)
  assert.match(api, /\.single\(\)/)
})
