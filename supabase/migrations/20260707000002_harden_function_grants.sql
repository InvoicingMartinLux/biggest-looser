-- Trigger function: never callable via API
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- RLS helpers: only needed by signed-in users' policies
revoke execute on function public.is_captain(uuid) from public, anon;
revoke execute on function public.is_competition_creator(uuid) from public, anon;

-- Invite actions require a signed-in user (functions also check auth.uid())
revoke execute on function public.accept_invite(uuid, uuid) from public, anon;
revoke execute on function public.decline_invite(uuid) from public, anon;

-- get_invite stays callable by anon on purpose: the invite landing page shows
-- invite details before login, gated by possession of the secret token.
