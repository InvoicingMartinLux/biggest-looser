-- ============ Biggest Looser app schema ============

-- Profiles (auto-created on signup)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  avatar_url text,
  weight_unit text not null default 'kg' check (weight_unit in ('kg','lbs')),
  target_weight_kg numeric(6,2) check (target_weight_kg is null or target_weight_kg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''), '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Weight log (one entry per user per day; competitions read from this)
create table public.weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  weight_kg numeric(6,2) not null check (weight_kg > 0),
  measured_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);
create index weigh_ins_user_date_idx on public.weigh_ins (user_id, measured_on desc);

-- Teams
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  image_url text,
  captain_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- Competitions
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('solo','team')),
  weigh_in_interval text not null check (weigh_in_interval in ('daily','weekly','monthly')),
  start_date date not null,
  end_date date not null,
  creator_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);

-- Participants: a user (solo) or a team (team competition)
create table public.competition_participants (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (team_id is null)),
  unique (competition_id, user_id),
  unique (competition_id, team_id)
);

-- Invites (team membership or competition entry), sent by email with a token link
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('team','competition')),
  team_id uuid references public.teams(id) on delete cascade,
  competition_id uuid references public.competitions(id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  check (
    (kind = 'team' and team_id is not null and competition_id is null)
    or (kind = 'competition' and competition_id is not null and team_id is null)
  )
);
create index invites_email_idx on public.invites (lower(email));

-- ============ Helper functions ============

create or replace function public.is_captain(_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from teams where id = _team and captain_id = auth.uid());
$$;

create or replace function public.is_competition_creator(_comp uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from competitions where id = _comp and creator_id = auth.uid());
$$;

-- ============ Row Level Security ============

alter table public.profiles enable row level security;
alter table public.weigh_ins enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_participants enable row level security;
alter table public.invites enable row level security;

-- Profiles: any signed-in user can see profiles (needed for standings/teams); only owner edits
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid());

-- Weigh-ins: visible to signed-in users (competitors must see each other's progress); only owner writes
create policy "weigh_ins_select" on public.weigh_ins for select to authenticated using (true);
create policy "weigh_ins_insert_own" on public.weigh_ins for insert to authenticated with check (user_id = auth.uid());
create policy "weigh_ins_update_own" on public.weigh_ins for update to authenticated using (user_id = auth.uid());
create policy "weigh_ins_delete_own" on public.weigh_ins for delete to authenticated using (user_id = auth.uid());

-- Teams
create policy "teams_select" on public.teams for select to authenticated using (true);
create policy "teams_insert" on public.teams for insert to authenticated with check (captain_id = auth.uid());
create policy "teams_update" on public.teams for update to authenticated using (captain_id = auth.uid());
create policy "teams_delete" on public.teams for delete to authenticated using (captain_id = auth.uid());

-- Team members: captain manages; members can leave
create policy "team_members_select" on public.team_members for select to authenticated using (true);
create policy "team_members_insert" on public.team_members for insert to authenticated
  with check (public.is_captain(team_id));
create policy "team_members_delete" on public.team_members for delete to authenticated
  using (public.is_captain(team_id) or user_id = auth.uid());

-- Competitions
create policy "competitions_select" on public.competitions for select to authenticated using (true);
create policy "competitions_insert" on public.competitions for insert to authenticated with check (creator_id = auth.uid());
create policy "competitions_update" on public.competitions for update to authenticated using (creator_id = auth.uid());
create policy "competitions_delete" on public.competitions for delete to authenticated using (creator_id = auth.uid());

-- Participants
create policy "participants_select" on public.competition_participants for select to authenticated using (true);
create policy "participants_insert" on public.competition_participants for insert to authenticated
  with check (public.is_competition_creator(competition_id) and (user_id = auth.uid() or public.is_captain(team_id)));
create policy "participants_delete" on public.competition_participants for delete to authenticated
  using (public.is_competition_creator(competition_id) or user_id = auth.uid() or public.is_captain(team_id));

-- Invites
create policy "invites_select" on public.invites for select to authenticated
  using (
    invited_by = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt()->>'email',''))
    or (kind = 'team' and public.is_captain(team_id))
    or (kind = 'competition' and public.is_competition_creator(competition_id))
  );
create policy "invites_insert" on public.invites for insert to authenticated
  with check (
    invited_by = auth.uid()
    and (
      (kind = 'team' and public.is_captain(team_id))
      or (kind = 'competition' and public.is_competition_creator(competition_id))
    )
  );
create policy "invites_delete" on public.invites for delete to authenticated
  using (
    invited_by = auth.uid()
    or (kind = 'team' and public.is_captain(team_id))
    or (kind = 'competition' and public.is_competition_creator(competition_id))
  );

-- ============ Invite RPCs (security definer: token possession grants access) ============

-- Public info about an invite, shown on the invite landing page (works before login)
create or replace function public.get_invite(invite_token uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  inv invites;
  result json;
begin
  select * into inv from invites where token = invite_token;
  if inv.id is null then
    return json_build_object('found', false);
  end if;
  select json_build_object(
    'found', true,
    'kind', inv.kind,
    'status', inv.status,
    'email', inv.email,
    'team_name', (select name from teams where id = inv.team_id),
    'competition_name', (select name from competitions where id = inv.competition_id),
    'competition_type', (select type from competitions where id = inv.competition_id),
    'inviter_name', (select display_name from profiles where id = inv.invited_by)
  ) into result;
  return result;
end $$;

grant execute on function public.get_invite(uuid) to anon, authenticated;

-- Accept an invite. For team-competition invites the accepter must pass a team they captain.
create or replace function public.accept_invite(invite_token uuid, join_team_id uuid default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  inv invites;
  comp competitions;
  accepted_count int;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'Not signed in');
  end if;

  select * into inv from invites where token = invite_token for update;
  if inv.id is null then
    return json_build_object('ok', false, 'error', 'Invite not found');
  end if;
  if inv.status <> 'pending' then
    return json_build_object('ok', false, 'error', 'Invite already ' || inv.status);
  end if;

  if inv.kind = 'team' then
    insert into team_members (team_id, user_id) values (inv.team_id, auth.uid())
    on conflict do nothing;
  else
    select * into comp from competitions where id = inv.competition_id;
    if comp.type = 'solo' then
      select count(*) into accepted_count from competition_participants
        where competition_id = comp.id and status = 'accepted' and user_id is distinct from auth.uid();
      if accepted_count >= 2 then
        return json_build_object('ok', false, 'error', 'This competition is already full');
      end if;
      insert into competition_participants (competition_id, user_id, status)
      values (comp.id, auth.uid(), 'accepted')
      on conflict (competition_id, user_id) do update set status = 'accepted';
    else
      if join_team_id is null then
        return json_build_object('ok', false, 'error', 'Choose a team you captain to join with', 'need_team', true);
      end if;
      if not exists (select 1 from teams where id = join_team_id and captain_id = auth.uid()) then
        return json_build_object('ok', false, 'error', 'You must be the captain of that team');
      end if;
      select count(*) into accepted_count from competition_participants
        where competition_id = comp.id and status = 'accepted' and team_id is distinct from join_team_id;
      if accepted_count >= 2 then
        return json_build_object('ok', false, 'error', 'This competition is already full');
      end if;
      insert into competition_participants (competition_id, team_id, status)
      values (comp.id, join_team_id, 'accepted')
      on conflict (competition_id, team_id) do update set status = 'accepted';
    end if;
  end if;

  update invites set status = 'accepted' where id = inv.id;
  return json_build_object('ok', true, 'kind', inv.kind, 'team_id', inv.team_id, 'competition_id', inv.competition_id);
end $$;

grant execute on function public.accept_invite(uuid, uuid) to authenticated;

create or replace function public.decline_invite(invite_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  inv invites;
begin
  select * into inv from invites where token = invite_token for update;
  if inv.id is null then
    return json_build_object('ok', false, 'error', 'Invite not found');
  end if;
  if inv.status <> 'pending' then
    return json_build_object('ok', false, 'error', 'Invite already ' || inv.status);
  end if;
  update invites set status = 'declined' where id = inv.id;
  return json_build_object('ok', true);
end $$;

grant execute on function public.decline_invite(uuid) to authenticated;

-- ============ Storage buckets for profile & team images ============

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('team-images', 'team-images', true)
on conflict (id) do nothing;

create policy "images_public_read" on storage.objects for select
  using (bucket_id in ('avatars', 'team-images'));
create policy "images_auth_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'team-images'));
create policy "images_owner_update" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'team-images') and owner = auth.uid());
create policy "images_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'team-images') and owner = auth.uid());
