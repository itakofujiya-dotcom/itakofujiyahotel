import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { isEmailAddress } from '../_shared/email-safety.ts'
import {
  GmailApiProvider,
  MailProviderError,
} from '../_shared/mail-provider.ts'
import { buildReservationCreatedEmail } from '../_shared/reservation-created-template.ts'
import type {
  ReservationNotificationSnapshot,
  MailProvider,
} from '../_shared/notification-types.ts'

type RuntimeEnvironment = { get(name: string): string | undefined }
declare const Deno: {
  env: RuntimeEnvironment
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, apikey, content-type, x-client-info, x-notification-worker-secret',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false }, 405)

  try {
    const supabaseUrl = requireEnvironment('SUPABASE_URL')
    const serviceRoleKey = requireEnvironment('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    // Validate provider configuration before claiming outbox rows so a missing
    // deployment secret cannot leave deliveries stranded in `sending`.
    const provider = createMailProvider(Deno.env)
    const senderEmail = requireEnvironment('GMAIL_SENDER_EMAIL')
    if (!isEmailAddress(senderEmail))
      throw new Error('INVALID_GMAIL_SENDER_EMAIL')
    const senderName =
      Deno.env.get('GMAIL_SENDER_NAME')?.trim() || '潮来富士屋ホテル'
    const workerSecret = Deno.env.get('NOTIFICATION_WORKER_SECRET')
    const suppliedWorkerSecret = request.headers.get(
      'x-notification-worker-secret',
    )
    const isScheduledWorker =
      Boolean(workerSecret) && suppliedWorkerSecret === workerSecret

    let deliveries: Array<{ id: string }> = []
    if (isScheduledWorker) {
      const { data, error } = await supabase.rpc(
        'claim_pending_notification_deliveries',
        { p_limit: 10 },
      )
      if (error) throw new Error(`CLAIM_BATCH_${error.code}`)
      deliveries = normalizeDeliveries(data)
    } else {
      const body = await readPublicRequest(request)
      if (!body) return jsonResponse({ ok: false }, 400)
      const { data, error } = await supabase.rpc(
        'claim_reservation_notification_deliveries',
        {
          p_reservation_id: body.reservationId,
          p_booking_request_id: body.bookingRequestId,
        },
      )
      if (error) throw new Error(`CLAIM_RESERVATION_${error.code}`)
      deliveries = normalizeDeliveries(data)
    }

    if (deliveries.length === 0)
      return jsonResponse({ ok: true, processed: 0 }, 202)

    let sent = 0
    let failed = 0
    let skipped = 0

    for (const delivery of deliveries) {
      const outcome = await processDelivery({
        deliveryId: delivery.id,
        supabase,
        provider,
        senderEmail,
        senderName,
      })
      if (outcome === 'sent') sent += 1
      else if (outcome === 'skipped') skipped += 1
      else failed += 1
    }

    return jsonResponse(
      { ok: failed === 0, processed: deliveries.length, sent, failed, skipped },
      failed === 0 ? 200 : 207,
    )
  } catch (error) {
    logError('notification_worker_failed', error)
    return jsonResponse({ ok: false }, 500)
  }
})

async function processDelivery({
  deliveryId,
  supabase,
  provider,
  senderEmail,
  senderName,
}: {
  deliveryId: string
  supabase: ReturnType<typeof createClient>
  provider: MailProvider
  senderEmail: string
  senderName: string
}): Promise<'sent' | 'failed' | 'skipped'> {
  try {
    const { data, error } = await supabase.rpc(
      'get_notification_reservation_snapshot',
      { p_delivery_id: deliveryId },
    )
    if (error || !isReservationSnapshot(data)) {
      await markFailed(
        supabase,
        deliveryId,
        'INVALID_SNAPSHOT',
        'Reservation notification data was unavailable.',
        true,
      )
      return 'skipped'
    }

    const recipient =
      data.recipientKind === 'hotel' ? data.hotel.email : data.guest.email
    if (!isEmailAddress(recipient)) {
      await markFailed(
        supabase,
        deliveryId,
        'RECIPIENT_MISSING',
        'The configured notification recipient is missing or invalid.',
        true,
      )
      return 'skipped'
    }

    const message = buildReservationCreatedEmail(data, senderEmail, senderName)
    const result = await provider.send({ ...message, to: recipient })
    const { error: markError } = await supabase.rpc(
      'mark_notification_delivery_sent',
      {
        p_delivery_id: deliveryId,
        p_provider: result.provider,
        p_provider_message_id: result.messageId,
      },
    )
    if (markError) throw new Error(`MARK_SENT_${markError.code}`)
    console.log(
      JSON.stringify({
        event: 'notification_sent',
        deliveryId,
        provider: result.provider,
      }),
    )
    return 'sent'
  } catch (error) {
    const code =
      error instanceof MailProviderError ? error.code : 'DELIVERY_FAILED'
    await markFailed(
      supabase,
      deliveryId,
      code,
      error instanceof Error ? error.message : 'Notification delivery failed.',
      false,
    )
    logError('notification_delivery_failed', error, { deliveryId, code })
    return 'failed'
  }
}

async function markFailed(
  supabase: ReturnType<typeof createClient>,
  deliveryId: string,
  code: string,
  message: string,
  skipped: boolean,
) {
  const { error } = await supabase.rpc('mark_notification_delivery_failed', {
    p_delivery_id: deliveryId,
    p_error_code: code,
    p_error_message: message,
    p_skipped: skipped,
  })
  if (error)
    logError('notification_mark_failed_error', new Error(error.message), {
      deliveryId,
      code: error.code,
    })
}

function createMailProvider(environment: RuntimeEnvironment): MailProvider {
  return new GmailApiProvider({
    clientId: requireEnvironment('GMAIL_CLIENT_ID', environment),
    clientSecret: requireEnvironment('GMAIL_CLIENT_SECRET', environment),
    refreshToken: requireEnvironment('GMAIL_REFRESH_TOKEN', environment),
  })
}

async function readPublicRequest(
  request: Request,
): Promise<{ reservationId: string; bookingRequestId: string } | null> {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 4096) return null
  try {
    const value = (await request.json()) as Record<string, unknown>
    if (
      typeof value.reservationId !== 'string' ||
      typeof value.bookingRequestId !== 'string' ||
      !uuidPattern.test(value.reservationId) ||
      !uuidPattern.test(value.bookingRequestId)
    )
      return null
    return {
      reservationId: value.reservationId,
      bookingRequestId: value.bookingRequestId,
    }
  } catch {
    return null
  }
}

function normalizeDeliveries(value: unknown): Array<{ id: string }> {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is { id: string } =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { id?: unknown }).id === 'string',
  )
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
    typeof snapshot.reservationNumber === 'string' &&
    (snapshot.locale === 'ja' || snapshot.locale === 'ko') &&
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
  environment: RuntimeEnvironment = Deno.env,
): string {
  const value = environment.get(name)?.trim()
  if (!value) throw new Error(`MISSING_${name}`)
  return value
}

function jsonResponse(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

function logError(
  event: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  console.error(
    JSON.stringify({
      event,
      ...context,
      errorType: error instanceof Error ? error.name : 'UnknownError',
      message:
        error instanceof Error ? error.message.slice(0, 500) : 'Unknown error',
    }),
  )
}
