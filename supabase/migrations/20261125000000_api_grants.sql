-- Grant the signed-in API role access to the cloud tables.
-- Needed when the Supabase project was created with
-- "Grant API access to new tables automatically" turned off.
-- Without this, the browser gets SQLSTATE 42501 (permission denied)
-- and backup never starts. Safe to run more than once.

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.businesses,
  public.business_members,
  public.entries,
  public.contacts,
  public.staff,
  public.goals
to authenticated;

grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.is_business_owner(uuid) to authenticated;
grant execute on function public.create_business(text) to authenticated;

notify pgrst, 'reload schema';
