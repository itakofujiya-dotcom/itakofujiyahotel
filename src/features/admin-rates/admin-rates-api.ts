import { supabase } from '../../lib/supabase/client'
import type {
  AdminRatesData,
  BaseRateChange,
  RateOverrideCreateInput,
  RateOverrideUpdateInput,
} from './types'

export class DuplicateRateOverrideError extends Error {}

export async function fetchAdminRates(): Promise<AdminRatesData> {
  const [roomTypesResult, baseRatesResult, overridesResult] = await Promise.all(
    [
      supabase
        .from('room_types')
        .select('id, code, name_ja, display_order')
        .order('display_order', { ascending: true }),
      supabase
        .from('room_rates')
        .select(
          `
          id,
          room_type_id,
          guest_count,
          valid_from,
          valid_to,
          price_per_person_yen,
          room_types (id, code, name_ja, display_order)
        `,
        )
        .order('guest_count', { ascending: true }),
      supabase
        .from('rate_overrides')
        .select(
          `
          id,
          room_type_id,
          stay_date,
          guest_count,
          price_per_person_yen,
          reason,
          room_types (id, code, name_ja, display_order)
        `,
        )
        .order('stay_date', { ascending: true })
        .order('guest_count', { ascending: true }),
    ],
  )

  const firstError =
    roomTypesResult.error ?? baseRatesResult.error ?? overridesResult.error
  if (firstError) {
    console.error('[Admin rates] Failed to load rate data.', {
      code: firstError.code,
      message: firstError.message,
    })
    throw new Error('RATES_FETCH_FAILED')
  }

  const baseRates = (baseRatesResult.data ?? [])
    .filter((rate) => rate.room_types !== null)
    .map((rate) => ({
      id: rate.id,
      room_type_id: rate.room_type_id,
      guest_count: rate.guest_count,
      valid_from: rate.valid_from,
      valid_to: rate.valid_to,
      price_per_person_yen: rate.price_per_person_yen,
      room_type: rate.room_types!,
    }))
    .sort(
      (a, b) =>
        a.room_type.display_order - b.room_type.display_order ||
        a.guest_count - b.guest_count,
    )

  const overrides = (overridesResult.data ?? [])
    .filter((rate) => rate.room_types !== null)
    .map((rate) => ({
      id: rate.id,
      room_type_id: rate.room_type_id,
      stay_date: rate.stay_date,
      guest_count: rate.guest_count,
      price_per_person_yen: rate.price_per_person_yen,
      reason: rate.reason,
      room_type: rate.room_types!,
    }))
    .sort(
      (a, b) =>
        a.stay_date.localeCompare(b.stay_date) ||
        a.room_type.display_order - b.room_type.display_order ||
        a.guest_count - b.guest_count,
    )

  return {
    roomTypes: roomTypesResult.data ?? [],
    baseRates,
    overrides,
  }
}

export async function updateBaseRoomRates(
  changes: BaseRateChange[],
): Promise<void> {
  const results = await Promise.allSettled(
    changes.map((change) =>
      supabase
        .from('room_rates')
        .update({ price_per_person_yen: change.nextPrice })
        .eq('id', change.id)
        .select('id')
        .single(),
    ),
  )

  const failed = results.find(
    (result) => result.status === 'rejected' || result.value.error !== null,
  )
  if (failed) {
    const error = failed.status === 'fulfilled' ? failed.value.error : null
    console.error('[Admin rates] Failed to update one or more base rates.', {
      code: error?.code,
      message: error?.message,
    })
    throw new Error('BASE_RATE_UPDATE_FAILED')
  }
}

export async function createRateOverride(
  input: RateOverrideCreateInput,
): Promise<void> {
  const { error } = await supabase
    .from('rate_overrides')
    .insert(input)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') throw new DuplicateRateOverrideError()
    console.error('[Admin rates] Failed to create a rate override.', {
      code: error.code,
      message: error.message,
    })
    throw new Error('RATE_OVERRIDE_CREATE_FAILED')
  }
}

export async function updateRateOverride(
  overrideId: string,
  input: RateOverrideUpdateInput,
): Promise<void> {
  const { error } = await supabase
    .from('rate_overrides')
    .update(input)
    .eq('id', overrideId)
    .select('id')
    .single()

  if (error) {
    console.error('[Admin rates] Failed to update a rate override.', {
      code: error.code,
      message: error.message,
    })
    throw new Error('RATE_OVERRIDE_UPDATE_FAILED')
  }
}

export async function deleteRateOverride(overrideId: string): Promise<void> {
  const { error } = await supabase
    .from('rate_overrides')
    .delete()
    .eq('id', overrideId)
    .select('id')
    .single()

  if (error) {
    console.error('[Admin rates] Failed to delete a rate override.', {
      code: error.code,
      message: error.message,
    })
    throw new Error('RATE_OVERRIDE_DELETE_FAILED')
  }
}
