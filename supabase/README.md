# Supabase setup

Apply `migrations/202608190001_initial_schema.sql`, then run `seed/seed.sql` in a development project.

The browser is intentionally unable to create reservations directly. A later Edge Function or RPC must validate availability and atomically create the reservation, payment record, and `inventory_blocks` row. The exclusion constraint on `inventory_blocks` prevents overlapping active/held stays for the same physical room using the checkout-exclusive `[check_in, check_out)` convention.

After linking a Supabase project, regenerate `src/types/database.ts` with the Supabase CLI.

## Bank-transfer expiration worker

Migration `202608250006_bank_transfer_auto_cancellation.sql` installs an hourly
Supabase Cron job (`5 * * * *`). The job calls the existing
`send-cancellation-email` Edge Function, whose authenticated worker path first
cancels expired unpaid bank-transfer reservations and then drains the existing
cancellation-email outbox.

Before enabling this in a hosted project, deploy the updated
`send-cancellation-email` function and add these two project Vault secrets:

- `bank_transfer_expiration_worker_url`: the full hosted URL ending in
  `/functions/v1/send-cancellation-email`
- `notification_worker_secret`: the same value already configured as the Edge
  Function's `NOTIFICATION_WORKER_SECRET`

The migration never stores either secret in source control. If either Vault
secret is absent, the hourly SQL remains inert and does not touch reservations.
