import type {
  EmailMessage,
  MailProvider,
  MailSendResult,
} from './notification-types.ts'
import { sanitizeEmailHeader } from './email-safety.ts'

export class MailProviderError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'MailProviderError'
    this.code = code
  }
}

export class GmailApiProvider implements MailProvider {
  private accessToken: string | null = null
  private accessTokenExpiresAt = 0
  private readonly config: {
    clientId: string
    clientSecret: string
    refreshToken: string
  }
  private readonly request: typeof fetch

  constructor(
    config: {
      clientId: string
      clientSecret: string
      refreshToken: string
    },
    request: typeof fetch = fetch,
  ) {
    this.config = config
    this.request = request
  }

  async send(message: EmailMessage): Promise<MailSendResult> {
    const accessToken = await this.getAccessToken()
    const response = await this.request(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodeBase64Url(buildMimeMessage(message)),
        }),
      },
    )
    if (!response.ok) {
      throw new MailProviderError(
        `GMAIL_SEND_${response.status}`,
        `Gmail API rejected the message with HTTP ${response.status}.`,
      )
    }
    const payload = (await response.json()) as { id?: unknown }
    if (typeof payload.id !== 'string' || payload.id.length === 0) {
      throw new MailProviderError(
        'GMAIL_INVALID_RESPONSE',
        'Gmail API did not return a message id.',
      )
    }
    return { provider: 'gmail_api', messageId: payload.id }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt)
      return this.accessToken

    const response = await this.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!response.ok) {
      throw new MailProviderError(
        `GMAIL_OAUTH_${response.status}`,
        `Google OAuth token refresh failed with HTTP ${response.status}.`,
      )
    }
    const payload = (await response.json()) as {
      access_token?: unknown
      expires_in?: unknown
    }
    if (typeof payload.access_token !== 'string') {
      throw new MailProviderError(
        'GMAIL_OAUTH_INVALID_RESPONSE',
        'Google OAuth did not return an access token.',
      )
    }
    const expiresIn =
      typeof payload.expires_in === 'number' ? payload.expires_in : 3600
    this.accessToken = payload.access_token
    this.accessTokenExpiresAt = Date.now() + Math.max(60, expiresIn - 60) * 1000
    return payload.access_token
  }
}

export function buildMimeMessage(message: EmailMessage): string {
  const boundary = `itako-fujiya-${crypto.randomUUID()}`
  const fromName = encodeMimeHeader(message.fromName)
  const subject = encodeMimeHeader(message.subject)
  const headers = [
    `From: ${fromName} <${sanitizeEmailHeader(message.fromEmail)}>`,
    `To: ${sanitizeEmailHeader(message.to)}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
  if (message.replyTo)
    headers.splice(2, 0, `Reply-To: ${sanitizeEmailHeader(message.replyTo)}`)
  return [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.text,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.html,
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

function encodeMimeHeader(value: string): string {
  return `=?UTF-8?B?${encodeBase64(sanitizeEmailHeader(value))}?=`
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

function encodeBase64Url(value: string): string {
  return encodeBase64(value)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '')
}
