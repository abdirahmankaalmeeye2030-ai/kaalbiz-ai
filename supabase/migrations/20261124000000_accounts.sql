-- KaalBiz accounts and cloud backup.
-- Run this whole file in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table public.entries (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  type text not null check (type in (
    'sale', 'expense', 'purchase', 'debt_given', 'debt_payment_received',
    'supplier_payment', 'supplier_debt', 'other'
  )),
  amount bigint not null check (amount >= 0),
  currency text not null default 'UGX' check (currency = 'UGX'),
  date date not null,
  description text not null check (char_length(trim(description)) between 1 and 180),
  category text not null check (char_length(trim(category)) between 1 and 40),
  counterparty text,
  confidence numeric not null default 1 check (confidence >= 0 and confidence <= 1),
  notes text,
  recorded_by text,
  phone text,
  location text,
  due_date date,
  agreed_amount bigint,
  source text not null default 'demo' check (source in ('ai', 'demo', 'sample')),
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (agreed_amount is null or (agreed_amount > 0 and agreed_amount <= amount))
);

create table public.contacts (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  phone text,
  location text,
  kind text not null check (kind in ('customer', 'supplier')),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.staff (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.goals (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  sell_at_least bigint,
  spend_at_most bigint,
  owe_less_than bigint,
  pay_suppliers bigint,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_date >= start_date),
  check (sell_at_least is null or sell_at_least > 0),
  check (spend_at_most is null or spend_at_most > 0),
  check (owe_less_than is null or owe_less_than > 0),
  check (pay_suppliers is null or pay_suppliers > 0)
);

create index entries_business_updated_idx on public.entries (business_id, updated_at);
create index contacts_business_updated_idx on public.contacts (business_id, updated_at);
create index staff_business_updated_idx on public.staff (business_id, updated_at);
create index goals_business_updated_idx on public.goals (business_id, updated_at);
create index business_members_user_idx on public.business_members (user_id);

create or replace function public.is_business_member(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where business_id = bid and user_id = auth.uid()
  );
$$;

create or replace function public.is_business_owner(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where business_id = bid and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.create_business(shop_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  bid uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if shop_name is null or char_length(trim(shop_name)) < 1 or char_length(trim(shop_name)) > 80 then
    raise exception 'Enter a shop name';
  end if;
  insert into public.businesses (id, name, owner_id)
  values (bid, trim(shop_name), auth.uid());
  insert into public.business_members (business_id, user_id, role)
  values (bid, auth.uid(), 'owner');
  return bid;
end;
$$;

revoke all on function public.is_business_member(uuid) from public;
revoke all on function public.is_business_owner(uuid) from public;
revoke all on function public.create_business(text) from public;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.is_business_owner(uuid) to authenticated;
grant execute on function public.create_business(text) to authenticated;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.entries enable row level security;
alter table public.contacts enable row level security;
alter table public.staff enable row level security;
alter table public.goals enable row level security;

create policy businesses_select on public.businesses
  for select to authenticated
  using (public.is_business_member(id));

create policy businesses_update on public.businesses
  for update to authenticated
  using (public.is_business_owner(id))
  with check (public.is_business_owner(id));

create policy businesses_delete on public.businesses
  for delete to authenticated
  using (public.is_business_owner(id));

create policy members_select on public.business_members
  for select to authenticated
  using (public.is_business_member(business_id));

-- The first owner row is inserted by create_business (security definer).
-- Direct inserts are limited to an owner adding someone else.
create policy members_insert on public.business_members
  for insert to authenticated
  with check (public.is_business_owner(business_id));

create policy members_update on public.business_members
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create policy members_delete on public.business_members
  for delete to authenticated
  using (public.is_business_owner(business_id) and user_id <> auth.uid());

create policy entries_all on public.entries
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy contacts_all on public.contacts
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy staff_all on public.staff
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy goals_all on public.goals
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));
