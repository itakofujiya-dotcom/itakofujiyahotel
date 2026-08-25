import { isEmailAddress } from '../_shared/email-safety.ts'
import type {
  MailProvider,
  ReservationNotificationSnapshot,
} from '../_shared/notification-types.ts'
import { createGmailMailer, GmailError } from './gmail.ts'
import {
  claimPendingReservationEmailDeliveries,
  claimReservationEmailDeliveries,
  createReservationEmailClient,
  loadReservationEmailSnapshot,
  markReservationEmailFailed,
  markReservationEmailSent,
  type NotificationDelivery,
} from './reservation-email.ts'
import { buildReservationCreatedEmail } from './templates.ts'

type RuntimeEnvironment = { get(name: string): string | undefined }
type ServerClient = ReturnType<typeof createReservationEmailClient>
type RecipientResult = {
  sent: boolean
  skipped?: boolean
  error?: string
}

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
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405)
  }

  try {
    const client = createReservationEmailClient()
    // Gmail credentials are read only inside gmail.ts. Validate them before
    // claiming outbox rows so configuration errors do not strand rows in
    // `sending` state.
    const { provider, senderEmail, senderName } = createGmailMailer()
    if (!isEmailAddress(senderEmail)) {
      throw new GmailError(
        'INVALID_GMAIL_SENDER_EMAIL',
        'GMAIL_SENDER_EMAIL is invalid.',
      )
    }

    const workerSecret = Deno.env.get('NOTIFICATION_WORKER_SECRET')?.trim()
    const suppliedWorkerSecret = request.headers.get(
      'x-notification-worker-secret',
    )
    const isScheduledWorker =
      Boolean(workerSecret) && suppliedWorkerSecret === workerSecret

    if (isScheduledWorker) {
      const deliveries = await claimPendingReservationEmailDeliveries(client)
      const outcomes = await processDeliveries({
        deliveries,
        client,
        provider,
        senderEmail,
        senderName,
      })
      return jsonResponse({
        ok: true,
        processed: deliveries.length,
        sent: outcomes.filter((outcome) => outcome.result.sent).length,
        failed: outcomes.filter(
          (outcome) => !outcome.result.sent && !outcome.result.skipped,
        ).length,
        skipped: outcomes.filter((outcome) => outcome.result.skipped).length,
      })
    }

    const body = await readBookingRequest(request)
    if (!body) {
      return jsonResponse({ ok: false, error: 'INVALID_REQUEST' }, 400)
    }
    const deliveries = await claimReservationEmailDeliveries(
      client,
      body.reservationId,
      body.bookingRequestId,
    )
    if (deliveries.length === 0) {
      // This deliberately does not reveal whether the reservation is missing,
      // already sent, or belongs to a different booking request.
      return jsonResponse({
        ok: true,
        reservationId: body.reservationId,
        duplicateOrUnavailable: true,
        customerEmail: { sent: false, skipped: true },
        adminEmail: { sent: false, skipped: true },
      })
    }

    const outcomes = await processDeliveries({
      deliveries,
      client,
      provider,
      senderEmail,
      senderName,
    })
    return jsonResponse({
      ok: true,
      reservationId: body.reservationId,
      customerEmail: resultFor(outcomes, 'customer'),
      adminEmail: resultFor(outcomes, 'hotel'),
    })
  } catch (error) {
    logError('send_booking_email_failed', error)
    return jsonResponse({ ok: false, error: 'EMAIL_SERVICE_ERROR' }, 500)
  }
})

async function processDeliveries({
  deliveries,
  client,
  provider,
  senderEmail,
  senderName,
}: {
  deliveries: NotificationDelivery[]
  client: ServerClient
  provider: MailProvider
  senderEmail: string
  senderName: string
}): Promise<
  Array<{
    recipientKind: 'customer' | 'hotel'
    result: RecipientResult
  }>
> {
  const outcomes = []
  for (const delivery of deliveries) {
    const result = await processDelivery({
      delivery,
      client,
      provider,
      senderEmail,
      senderName,
    })
    outcomes.push({ recipientKind: delivery.recipientKind, result })
  }
  return outcomes
}

async function processDelivery({
  delivery,
  client,
  provider,
  senderEmail,
  senderName,
}: {
  delivery: NotificationDelivery
  client: ServerClient
  provider: MailProvider
  senderEmail: string
  senderName: string
}): Promise<RecipientResult> {
  try {
    const snapshot = await loadReservationEmailSnapshot(client, delivery.id)
    const recipient = resolveRecipient(snapshot, senderEmail)
    if (!isEmailAddress(recipient)) {
      await markReservationEmailFailed(
        client,
        delivery.id,
        'RECIPIENT_MISSING',
        'The configured recipient is missing or invalid.',
        true,
      )
      return { sent: false, skipped: true, error: 'RECIPIENT_MISSING' }
    }

    const message = buildReservationCreatedEmail(
      snapshot,
      senderEmail,
      senderName,
    )
    const sent = await provider.send({ ...message, to: recipient })
    await markReservationEmailSent(
      client,
      delivery.id,
      sent.provider,
      sent.messageId,
    )
    console.log(
      JSON.stringify({
        event: 'reservation_email_sent',
        deliveryId: delivery.id,
        recipientKind: delivery.recipientKind,
        provider: sent.provider,
      }),
    )
    return { sent: true }
  } catch (error) {
    const code = error instanceof GmailError ? error.code : 'DELIVERY_FAILED'
    try {
      await markReservationEmailFailed(
        client,
        delivery.id,
        code,
        error instanceof Error ? error.message : 'Email delivery failed.',
      )
    } catch (markError) {
      logError('reservation_email_mark_failed', markError, {
        deliveryId: delivery.id,
      })
    }
    logError('reservation_email_delivery_failed', error, {
      deliveryId: delivery.id,
      recipientKind: delivery.recipientKind,
      code,
    })
    return { sent: false, error: code }
  }
}

function resolveRecipient(
  snapshot: ReservationNotificationSnapshot,
  senderEmail: string,
): string {
  return snapshot.recipientKind === 'hotel'
    ? snapshot.hotel.email || senderEmail
    : snapshot.guest.email
}

function resultFor(
  outcomes: Array<{
    recipientKind: 'customer' | 'hotel'
    result: RecipientResult
  }>,
  recipientKind: 'customer' | 'hotel',
): RecipientResult {
  return (
    outcomes.find((outcome) => outcome.recipientKind === recipientKind)
      ?.result || { sent: false, skipped: true }
  )
}

async function readBookingRequest(request: Request): Promise<{
  reservationId: string
  bookingRequestId: string
} | null> {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 4096) return null
  try {
    const value = (await request.json()) as Record<string, unknown>
    if (
      typeof value.reservation_id !== 'string' ||
      typeof value.booking_request_id !== 'string' ||
      !uuidPattern.test(value.reservation_id) ||
      !uuidPattern.test(value.booking_request_id)
    ) {
      return null
    }
    return {
      reservationId: value.reservation_id,
      bookingRequestId: value.booking_request_id,
    }
  } catch {
    return null
  }
}

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

function logError(
  event: string,
  error: unknown,
  metadata: Record<string, unknown> = {},
) {
  console.error(
    JSON.stringify({
      event,
      ...metadata,
      errorType: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unknown error',
    }),
  )
}
