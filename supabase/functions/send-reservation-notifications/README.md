# Reservation notification worker

This Edge Function sends `reservation_created` messages queued in
`public.notification_deliveries`. It uses the Gmail API with OAuth; it never
accepts a destination address or message body from the browser.

## Required Supabase secrets

```bash
supabase secrets set \
  GMAIL_CLIENT_ID=... \
  GMAIL_CLIENT_SECRET=... \
  GMAIL_REFRESH_TOKEN=... \
  GMAIL_SENDER_EMAIL=itakofujiya@gmail.com \
  GMAIL_SENDER_NAME='潮来富士屋ホテル' \
  NOTIFICATION_WORKER_SECRET=...
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied to hosted Edge
Functions by Supabase. Do not add any of these values to Vite environment
variables or commit them to the repository.

The Google account must have authorized the OAuth client with the narrow
`https://www.googleapis.com/auth/gmail.send` scope. The refresh token belongs to
the configured sender account.

## Invocation modes

- After a public booking, the browser sends only `reservationId` and the opaque
  `bookingRequestId`. The worker verifies that exact pair in the database and
  resolves both recipients server-side.
- Configure a Supabase Cron job to POST to this function every minute with
  `x-notification-worker-secret`. It drains pending rows if immediate browser
  invocation was interrupted. Store both the project URL and worker secret in
  Supabase Vault when configuring the cron request.

Do not put the worker secret directly in a migration. This repository therefore
creates the queue and worker but deliberately leaves the project-specific cron
request to deployment setup.

## Delivery semantics

The unique key `(reservation_id, notification_type, recipient_kind)` prevents
duplicate queue entries. Rows are claimed with `FOR UPDATE SKIP LOCKED` and sent
at most once automatically. Explicit provider failures are marked `failed`; an
operator should inspect the structured Edge Function log before manually
re-queuing. This avoids sending a duplicate after an ambiguous provider timeout.
