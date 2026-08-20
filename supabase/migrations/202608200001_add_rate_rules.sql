-- Reusable rate adjustments and their date assignments.
-- Legacy rate_overrides remains the highest-priority direct-price fallback.

create table public.rate_rules (
  id uuid primary key default gen_random_uuid(),
  name_ja text not null,
  name_en text,
  name_ko text,
  description_ja text,
  description_en text,
  description_ko text,
  adjustment_type text not null
    check (adjustment_type in ('fixed_amount', 'percentage')),
  adjustment_value integer not null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_rate_rules_updated_at
before update on public.rate_rules
for each row
execute function public.set_updated_at();

create table public.rate_rule_dates (
  id uuid primary key default gen_random_uuid(),
  rate_rule_id uuid not null
    references public.rate_rules(id)
    on delete cascade,
  stay_date date not null unique,
  created_at timestamptz not null default now()
);

create index rate_rule_dates_rule_idx
on public.rate_rule_dates(rate_rule_id);

create index rate_rule_dates_stay_date_idx
on public.rate_rule_dates(stay_date);

alter table public.rate_rules enable row level security;
alter table public.rate_rule_dates enable row level security;

-- These tables are admin-only for now. Public pricing will later use a narrowly
-- scoped RPC/view so inactive rules and operational metadata are not exposed.
create policy "admin manage rate rules"
on public.rate_rules
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admin manage rate rule dates"
on public.rate_rule_dates
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete
on public.rate_rules
to authenticated;

grant select, insert, update, delete
on public.rate_rule_dates
to authenticated;
