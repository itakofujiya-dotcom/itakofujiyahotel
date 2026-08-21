import type { BookingRoomInput, MealPlan } from './types'

export const DINNER_SURCHARGE_PER_ADULT_PER_NIGHT_YEN = 2_000

export const mealPlanLabels: Record<MealPlan, string> = {
  breakfast: '朝食付き',
  breakfast_dinner: '朝食・夕食付き',
}

export function calculateMealSurcharge({
  mealPlan,
  adultGuestCount,
  nights,
}: Pick<BookingRoomInput, 'mealPlan' | 'adultGuestCount'> & {
  nights: number
}): number {
  return mealPlan === 'breakfast_dinner'
    ? adultGuestCount * nights * DINNER_SURCHARGE_PER_ADULT_PER_NIGHT_YEN
    : 0
}

export function isMealPlan(value: unknown): value is MealPlan {
  return value === 'breakfast' || value === 'breakfast_dinner'
}
