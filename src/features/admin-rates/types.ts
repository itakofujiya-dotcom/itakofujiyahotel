export type RateRoomType = {
  id: string
  code: string
  name_ja: string
  display_order: number
}

export type BaseRoomRate = {
  id: string
  room_type_id: string
  guest_count: number
  valid_from: string
  valid_to: string
  price_per_person_yen: number
  room_type: RateRoomType
}

export type RateOverride = {
  id: string
  room_type_id: string
  stay_date: string
  guest_count: number
  price_per_person_yen: number
  reason: string | null
  room_type: RateRoomType
}

export type BaseRateChange = {
  id: string
  guest_count: number
  previousPrice: number
  nextPrice: number
}

export type RateOverrideCreateInput = {
  room_type_id: string
  stay_date: string
  guest_count: number
  price_per_person_yen: number
  reason: string | null
}

export type RateOverrideUpdateInput = {
  price_per_person_yen: number
  reason: string | null
}

export type AdminRatesData = {
  roomTypes: RateRoomType[]
  baseRates: BaseRoomRate[]
  overrides: RateOverride[]
}

export type RateAdjustmentType = 'fixed_amount' | 'percentage'

export type RateRule = {
  id: string
  name_ja: string
  name_en: string | null
  name_ko: string | null
  description_ja: string | null
  description_en: string | null
  description_ko: string | null
  adjustment_type: RateAdjustmentType
  adjustment_value: number
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export type RateRuleDate = {
  id: string
  rate_rule_id: string
  stay_date: string
  created_at: string
  rate_rule: RateRule
}

export type RateRuleCreateInput = {
  name_ja: string
  description_ja: string | null
  adjustment_type: RateAdjustmentType
  adjustment_value: number
}

export type RateRuleUpdateInput = {
  name_ja: string
  description_ja: string | null
  adjustment_value: number
  is_active: boolean
}
