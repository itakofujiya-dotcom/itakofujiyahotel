import { isEmailAddress } from '../_shared/email-safety.ts'
import type { MailProvider } from '../_shared/notification-types.ts'
import { createGmailMailer, GmailError } from '../send-booking-email/gmail.ts'
import {
  claimPendingAutoCancellationDeliveries,
  claimPublicCancellationDeliveries,
  createCancellationEmailClient,
  loadCancellationSnapshot,
  markCancellationEmailFailed,
  markCancellationEmailSent,
  processExpiredBankTransferReservations,
  type CancellationDelivery,
  type CancellationEmailClient,
} from './cancellation-email.ts'
import { buildCancellationEmail } from './templates.ts'

type RuntimeEnvironment = { get(name: string): string | undefined }
declare const Deno: {
  env: RuntimeEnvironment
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-notification-worker-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST')
    return jsonResponse({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const client = createCancellationEmailClient()
    const workerSecret = Deno.env.get('NOTIFICATION_WORKER_SECRET')?.trim()
    const isWorker =
      Boolean(workerSecret) &&
      request.headers.get('x-notification-worker-secret') === workerSecret
    const input = isWorker ? null : await readPublicRequest(request)
    if (!isWorker && !input)
      return jsonResponse({ ok: false, error: 'INVALID_REQUEST' }, 400)

    const expirationResult = isWorker
      ? await processExpiredBankTransferReservations(client)
      : null
    if (expirationResult) {
      console.log(
        JSON.stringify({
          event: 'bank_transfer_expiration_processed',
          processed: expirationResult.processed,
          releasedInventoryBlocks:
            expirationResult.releasedInventoryBlocks,
          notificationsEnqueued: expirationResult.notificationsEnqueued,
        }),
      )
    }

    const { provider, senderEmail, senderName } = createGmailMailer()
    if (!isEmailAddress(senderEmail))
      throw new GmailError(
        'INVALID_GMAIL_SENDER_EMAIL',
        'GMAIL_SENDER_EMAIL is invalid.',
      )

    const deliveries = isWorker
      ? await claimPendingAutoCancellationDeliveries(client)
      : await claimPublicCancellationDeliveries(
          client,
          input!.reservationNumber,
          input!.contact,
        )
    if (deliveries.length === 0)
      return jsonResponse({
        ok: true,
        duplicateOrUnavailable: true,
        autoCancellation: expirationResult,
      })

    const outcomes = await processDeliveries(
      deliveries,
      client,
      provider,
      senderEmail,
      senderName,
    )
    return jsonResponse({
      ok: true,
      processed: outcomes.length,
      sent: outcomes.filter((sent) => sent).length,
      failed: outcomes.filter((sent) => !sent).length,
      autoCancellation: expirationResult,
    })
  } catch (error) {
    logError('send_cancellation_email_failed', error)
    return jsonResponse({ ok: false, error: 'EMAIL_SERVICE_ERROR' }, 500)
  }
})

async function processDeliveries(
  deliveries: CancellationDelivery[],
  client: CancellationEmailClient,
  provider: MailProvider,
  senderEmail: string,
  senderName: string,
) {
  const outcomes: boolean[] = []
  for (const delivery of deliveries) {
    try {
      const snapshot = await loadCancellationSnapshot(client, delivery.id)
      const recipient =
        delivery.recipientKind === 'hotel'
          ? snapshot.hotel.email || senderEmail
          : snapshot.guest.email
      if (!isEmailAddress(recipient)) {
        await markCancellationEmailFailed(
          client,
          delivery.id,
          'RECIPIENT_MISSING',
          'The configured recipient is missing or invalid.',
          true,
        )
        outcomes.push(false)
        continue
      }
      const message = buildCancellationEmail(snapshot, senderEmail, senderName)
      const sent = await provider.send({ ...message, to: recipient })
      await markCancellationEmailSent(
        client,
        delivery.id,
        sent.provider,
        sent.messageId,
      )
      console.log(
        JSON.stringify({
          event: 'cancellation_email_sent',
          deliveryId: delivery.id,
          recipientKind: delivery.recipientKind,
          provider: sent.provider,
        }),
      )
      outcomes.push(true)
    } catch (error) {
      const code = error instanceof GmailError ? error.code : 'DELIVERY_FAILED'
      try {
        await markCancellationEmailFailed(
          client,
          delivery.id,
          code,
          error instanceof Error ? error.message : 'Email delivery failed.',
        )
      } catch (markError) {
        logError('cancellation_email_mark_failed', markError, {
          deliveryId: delivery.id,
        })
      }
      logError('cancellation_email_delivery_failed', error, {
        deliveryId: delivery.id,
        recipientKind: delivery.recipientKind,
      })
      outcomes.push(false)
    }
  }
  return outcomes
}

async function readPublicRequest(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 4096) return null
  try {
    const value = (await request.json()) as Record<string, unknown>
    if (
      typeof value.reservation_number !== 'string' ||
      typeof value.contact !== 'string'
    )
      return null
    const reservationNumber = value.reservation_number.trim()
    const contact = value.contact.trim()
    if (
      reservationNumber.length < 3 ||
      reservationNumber.length > 100 ||
      contact.length < 3 ||
      contact.length > 254
    )
      return null
    return { reservationNumber, contact }
  } catch {
    return null
  }
}

function jsonResponse(body: object, status = 200) {
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
