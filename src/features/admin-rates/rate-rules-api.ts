import { supabase } from '../../lib/supabase/client'
import type {
  RateRule,
  RateRuleCreateInput,
  RateRuleDate,
  RateRuleUpdateInput,
} from './types'

export class DuplicateRateRuleDateError extends Error {}

export async function fetchRateRules(): Promise<RateRule[]> {
  const { data, error } = await supabase
    .from('rate_rules')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    logRateRuleError('load rules', error)
    throw new Error('RATE_RULES_FETCH_FAILED')
  }
  return data
}

export async function fetchRateRuleDates(): Promise<RateRuleDate[]> {
  const { data, error } = await supabase
    .from('rate_rule_dates')
    .select('id, rate_rule_id, stay_date, created_at, rate_rules (*)')
    .order('stay_date', { ascending: true })
  if (error) {
    logRateRuleError('load rule dates', error)
    throw new Error('RATE_RULE_DATES_FETCH_FAILED')
  }
  return data
    .filter((item) => item.rate_rules !== null)
    .map((item) => ({
      id: item.id,
      rate_rule_id: item.rate_rule_id,
      stay_date: item.stay_date,
      created_at: item.created_at,
      rate_rule: item.rate_rules!,
    }))
}

export async function createRateRule(
  input: RateRuleCreateInput,
): Promise<void> {
  const { error } = await supabase
    .from('rate_rules')
    .insert(input)
    .select('id')
    .single()
  if (error) {
    logRateRuleError('create rule', error)
    throw new Error('RATE_RULE_CREATE_FAILED')
  }
}

export async function updateRateRule(
  ruleId: string,
  input: RateRuleUpdateInput,
): Promise<void> {
  const { error } = await supabase
    .from('rate_rules')
    .update(input)
    .eq('id', ruleId)
    .select('id')
    .single()
  if (error) {
    logRateRuleError('update rule', error)
    throw new Error('RATE_RULE_UPDATE_FAILED')
  }
}

export async function disableRateRule(ruleId: string): Promise<void> {
  const { error } = await supabase
    .from('rate_rules')
    .update({ is_active: false })
    .eq('id', ruleId)
    .select('id')
    .single()
  if (error) {
    logRateRuleError('disable rule', error)
    throw new Error('RATE_RULE_DISABLE_FAILED')
  }
}

export async function applyRuleToDates(
  ruleId: string,
  stayDates: string[],
  replace: boolean,
): Promise<void> {
  const rows = stayDates.map((stayDate) => ({
    rate_rule_id: ruleId,
    stay_date: stayDate,
  }))
  const query = replace
    ? supabase
        .from('rate_rule_dates')
        .upsert(rows, { onConflict: 'stay_date' })
        .select('id, stay_date')
    : supabase.from('rate_rule_dates').insert(rows).select('id, stay_date')
  const { data, error } = await query

  if (error) {
    if (error.code === '23505') throw new DuplicateRateRuleDateError()
    logRateRuleError('apply rule to dates', error)
    throw new Error('RATE_RULE_APPLY_FAILED')
  }
  if (data.length !== stayDates.length) {
    throw new Error('RATE_RULE_APPLY_INCOMPLETE')
  }
}

export async function removeRateRuleFromDate(stayDate: string): Promise<void> {
  await removeRateRulesFromDates([stayDate])
}

export async function removeRateRulesFromDates(
  stayDates: string[],
): Promise<void> {
  const uniqueDates = [...new Set(stayDates)]
  if (uniqueDates.length === 0) return

  const { data, error } = await supabase
    .from('rate_rule_dates')
    .delete()
    .in('stay_date', uniqueDates)
    .select('id, stay_date')
  if (error) {
    logRateRuleError('remove rule dates', error)
    throw new Error('RATE_RULE_DATE_DELETE_FAILED')
  }

  const deletedDates = new Set(data.map((row) => row.stay_date))
  if (
    deletedDates.size !== uniqueDates.length ||
    uniqueDates.some((stayDate) => !deletedDates.has(stayDate))
  ) {
    console.error('[Admin rates] Failed to verify removed rule dates.', {
      requestedDates: uniqueDates,
      deletedDates: [...deletedDates],
    })
    throw new Error('RATE_RULE_DATE_DELETE_INCOMPLETE')
  }
}

function logRateRuleError(
  operation: string,
  error: { code: string; message: string },
) {
  console.error(`[Admin rates] Failed to ${operation}.`, {
    code: error.code,
    message: error.message,
  })
}
