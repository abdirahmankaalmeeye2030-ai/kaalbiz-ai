-- Optional unit price for sales and stock. Safe to run more than once.
-- Older rows stay blank.

alter table public.entries add column if not exists unit_price bigint check (unit_price is null or unit_price > 0);

notify pgrst, 'reload schema';
