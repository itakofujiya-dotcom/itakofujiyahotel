import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import type { CancellationNotificationSnapshot } from '../_shared/notification-types.ts'

type RuntimeEnvironment = { get(name: string): string | undefined }
type DeliveryRow = { id: string; recipient_kind: 'customer' | 'hotel' }
type CancellationEmailDatabase = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: {
      claim_public_cancellation_notifications: {
        Args: { p_reservation_number: string; p_contact: string }
        Returns: DeliveryRow[]
      }
      claim_pending_cancellation_notifications: {
        Args: { p_limit?: number }
        Returns: DeliveryRow[]
      }
      get_cancellation_notification_snapshot: {
        Args: { p_delivery_id: string }
        Returns: unknown
      }
      mark_notification_delivery_sent: {
        Args: {
          p_delivery_id: string
          p_provider: string
          p_provider_message_id: string
        }
        Returns: undefined
      }
      mark_notification_delivery_failed: {
        Args: {
          p_delivery_id: string
          p_error_code: string
          p_error_message: string
          p_skipped?: boolean
        }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

declare const Deno: { env: RuntimeEnvironment }

export type CancellationDelivery = {
  id: string
  recipientKind: 'customer' | 'hotel'
}

export function createCancellationEmailClient(
  environment: RuntimeEnvironment = Deno.env,
) {
  return createClient<CancellationEmailDatabase>(
    requireEnvironment('SUPABASE_URL', environment),
    requireEnvironment('SUPABASE_SERVICE_ROLE_KEY', environment),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export type CancellationEmailClient = ReturnType<
  typeof createCancellationEmailClient
>

export async function claimPublicCancellationDeliveries(
  client: CancellationEmailClient,
  reservationNumber: string,
  contact: string,
): Promise<CancellationDelivery[]> {
  const { data, error } = await client.rpc(
    'claim_public_cancellation_notifications',
    { p_reservation_number: reservationNumber, p_contact: contact },
  )
  if (error) throw new Error(`CLAIM_CANCELLATION_${error.code}`)
  return normalizeDeliveries(data)
}

export async function claimPendingCancellationDeliveries(
  client: CancellationEmailClient,
  limit = 10,
): Promise<CancellationDelivery[]> {
  const { data, error } = await client.rpc(
    'claim_pending_cancellation_notifications',
    { p_limit: limit },
  )
  if (error) throw new Error(`CLAIM_CANCELLATION_BATCH_${error.code}`)
  return normalizeDeliveries(data)
}

export async function loadCancellationSnapshot(
  client: CancellationEmailClient,
  deliveryId: string,
): Promise<CancellationNotificationSnapshot> {
  const { data, error } = await client.rpc(
    'get_cancellation_notification_snapshot',
    { p_delivery_id: deliveryId },
  )
  if (error || !isCancellationSnapshot(data)) {
    throw new Error('INVALID_CANCELLATION_EMAIL_SNAPSHOT')
  }
  return data
}

export async function markCancellationEmailSent(
  client: CancellationEmailClient,
  deliveryId: string,
  provider: string,
  providerMessageId: string,
): Promise<void> {
  const { error } = await client.rpc('mark_notification_delivery_sent', {
    p_delivery_id: deliveryId,
    p_provider: provider,
    p_provider_message_id: providerMessageId,
  })
  if (error) throw new Error(`MARK_CANCELLATION_SENT_${error.code}`)
}

export async function markCancellationEmailFailed(
  client: CancellationEmailClient,
  deliveryId: string,
  code: string,
  message: string,
  skipped = false,
): Promise<void> {
  const { error } = await client.rpc('mark_notification_delivery_failed', {
    p_delivery_id: deliveryId,
    p_error_code: code,
    p_error_message: message,
    p_skipped: skipped,
  })
  if (error) throw new Error(`MARK_CANCELLATION_FAILED_${error.code}`)
}

function normalizeDeliveries(value: unknown): CancellationDelivery[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const row = item as { id?: unknown; recipient_kind?: unknown }
    if (
      typeof row.id !== 'string' ||
      (row.recipient_kind !== 'customer' && row.recipient_kind !== 'hotel')
    )
      return []
    return [{ id: row.id, recipientKind: row.recipient_kind }]
  })
}

function isCancellationSnapshot(
  value: unknown,
): value is CancellationNotificationSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const snapshot = value as Partial<CancellationNotificationSnapshot>
  return (
    typeof snapshot.deliveryId === 'string' &&
    (snapshot.recipientKind === 'customer' ||
      snapshot.recipientKind === 'hotel') &&
    snapshot.notificationType === 'reservation_cancelled' &&
    typeof snapshot.reservationNumber === 'string' &&
    (snapshot.locale === 'ja' || snapshot.locale === 'ko') &&
    typeof snapshot.cancelledAt === 'string' &&
    typeof snapshot.guest === 'object' &&
    snapshot.guest !== null &&
    typeof snapshot.payment === 'object' &&
    snapshot.payment !== null &&
    typeof snapshot.hotel === 'object' &&
    snapshot.hotel !== null &&
    Array.isArray(snapshot.rooms)
  )
}

function requireEnvironment(name: string, environment: RuntimeEnvironment) {
  const value = environment.get(name)?.trim()
  if (!value) throw new Error(`MISSING_${name}`)
  return value
}
