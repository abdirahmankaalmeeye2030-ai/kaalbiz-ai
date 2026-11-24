-- RLS smoke checks. Run in the Supabase SQL editor after the migration.
-- These statements do not print a pass/fail by themselves. After each one,
-- the result should match the comment. A full login test needs two users.

-- 1. Every app table has RLS on.
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('businesses', 'business_members', 'entries', 'contacts', 'staff', 'goals')
order by relname;
-- Expect six rows, all with relrowsecurity = true.

-- 2. Anonymous users cannot read entries.
set role anon;
select count(*) from public.entries;
-- Expect an error or zero rows, never another shop's data.
reset role;
