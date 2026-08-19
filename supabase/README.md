# Supabase setup

Apply `migrations/202608190001_initial_schema.sql`, then run `seed/seed.sql` in a development project.

The browser is intentionally unable to create reservations directly. A later Edge Function or RPC must validate availability and atomically create the reservation, payment record, and `inventory_blocks` row. The exclusion constraint on `inventory_blocks` prevents overlapping active/held stays for the same physical room using the checkout-exclusive `[check_in, check_out)` convention.

After linking a Supabase project, regenerate `src/types/database.ts` with the Supabase CLI.
