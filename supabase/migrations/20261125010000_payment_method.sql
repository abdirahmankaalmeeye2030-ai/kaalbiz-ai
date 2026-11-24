-- Optional sale payment method. Safe to run after the accounts migration.
-- Existing rows stay null. Cash and mobile money are the only values.

alter table public.entries
  add column if not exists payment_method text;

alter table public.entries
  drop constraint if exists entries_payment_method_check;

alter table public.entries
  add constraint entries_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'mobile_money'));

notify pgrst, 'reload schema';
