import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import type { ReservationNotificationSnapshot } from '../_shared/notification-types.ts'

type RuntimeEnvironment = { get(name: string): string | undefined }
type DeliveryRow = {
  id: string
  recipient_kind: 'customer' | 'hotel'
}
type EmailDatabase = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: {
      claim_reservation_notification_deliveries: {
        Args: { p_reservation_id: string; p_booking_request_id: string }
        Returns: DeliveryRow[]
      }
      claim_pending_notification_deliveries: {
        Args: { p_limit?: number }
        Returns: DeliveryRow[]
      }
      get_notification_reservation_snapshot: {
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
type ServerClient = ReturnType<typeof createClient<EmailDatabase>>

declare const Deno: { env: RuntimeEnvironment }

export type NotificationDelivery = {
  id: string
  recipientKind: 'customer' | 'hotel'
}

export function createReservationEmailClient(
  environment: RuntimeEnvironment = Deno.env,
): ServerClient {
  return createClient<EmailDatabase>(
    requireEnvironment('SUPABASE_URL', environment),
    requireEnvironment('SUPABASE_SERVICE_ROLE_KEY', environment),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function claimReservationEmailDeliveries(
  client: ServerClient,
  reservationId: string,
  bookingRequestId: string,
): Promise<NotificationDelivery[]> {
  const { data, error } = await client.rpc(
    'claim_reservation_notification_deliveries',
    {
      p_reservation_id: reservationId,
      p_booking_request_id: bookingRequestId,
    },
  )
  if (error) throw new Error(`CLAIM_RESERVATION_${error.code}`)
  return normalizeDeliveries(data)
}

export async function claimPendingReservationEmailDeliveries(
  client: ServerClient,
  limit = 10,
): Promise<NotificationDelivery[]> {
  const { data, error } = await client.rpc(
    'claim_pending_notification_deliveries',
    { p_limit: limit },
  )
  if (error) throw new Error(`CLAIM_BATCH_${error.code}`)
  return normalizeDeliveries(data)
}

export async function loadReservationEmailSnapshot(
  client: ServerClient,
  deliveryId: string,
): Promise<ReservationNotificationSnapshot> {
  const { data, error } = await client.rpc(
    'get_notification_reservation_snapshot',
    { p_delivery_id: deliveryId },
  )
  if (error || !isReservationSnapshot(data)) {
    throw new Error('INVALID_RESERVATION_EMAIL_SNAPSHOT')
  }
  return data
}

export async function markReservationEmailSent(
  client: ServerClient,
  deliveryId: string,
  provider: string,
  providerMessageId: string,
): Promise<void> {
  const { error } = await client.rpc('mark_notification_delivery_sent', {
    p_delivery_id: deliveryId,
    p_provider: provider,
    p_provider_message_id: providerMessageId,
  })
  if (error) throw new Error(`MARK_SENT_${error.code}`)
}

export async function markReservationEmailFailed(
  client: ServerClient,
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
  if (error) throw new Error(`MARK_FAILED_${error.code}`)
}

function normalizeDeliveries(value: unknown): NotificationDelivery[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const row = item as { id?: unknown; recipient_kind?: unknown }
    if (
      typeof row.id !== 'string' ||
      (row.recipient_kind !== 'customer' && row.recipient_kind !== 'hotel')
    ) {
      return []
    }
    return [{ id: row.id, recipientKind: row.recipient_kind }]
  })
}

function isReservationSnapshot(
  value: unknown,
): value is ReservationNotificationSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const snapshot = value as Partial<ReservationNotificationSnapshot>
  return (
    typeof snapshot.deliveryId === 'string' &&
    (snapshot.recipientKind === 'customer' ||
      snapshot.recipientKind === 'hotel') &&
    snapshot.notificationType === 'reservation_created' &&
    typeof snapshot.reservationId === 'string' &&
    typeof snapshot.reservationNumber === 'string' &&
    (snapshot.locale === 'ja' || snapshot.locale === 'ko') &&
    typeof snapshot.checkIn === 'string' &&
    typeof snapshot.checkOut === 'string' &&
    typeof snapshot.guest === 'object' &&
    snapshot.guest !== null &&
    typeof snapshot.hotel === 'object' &&
    snapshot.hotel !== null &&
    typeof snapshot.payment === 'object' &&
    snapshot.payment !== null &&
    Array.isArray(snapshot.rooms) &&
    Array.isArray(snapshot.cancellationPolicies)
  )
}

function requireEnvironment(
  name: string,
  environment: RuntimeEnvironment,
): string {
  const value = environment.get(name)?.trim()
  if (!value) throw new Error(`MISSING_${name}`)
  return value
}
