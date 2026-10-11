-- Proposed Supabase migration; not connected to the app or applied remotely.
-- Canonical data is JSON; Markdown is generated on export, never used as instructions.
begin;
create table public.learner_profiles (
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_id text not null check (length(conversation_id) between 1 and 64),
  schema_version integer not null default 1 check (schema_version = 1),
  preferences jsonb not null check (
    jsonb_typeof(preferences) = 'object'
    and preferences ?& array['familiarity', 'goal', 'language', 'explanation']
    and preferences - array['familiarity', 'goal', 'language', 'explanation'] = '{}'::jsonb
    and preferences->>'familiarity' in ('new', 'some-basics', 'exploring')
    and preferences->>'goal' in ('basics', 'sip', 'asset-types', 'risk', 'fund-costs')
    and preferences->>'language' in ('english', 'hindi', 'hinglish')
    and preferences->>'explanation' in ('short', 'example', 'steps')
    and jsonb_typeof(preferences->'familiarity') = 'string'
    and jsonb_typeof(preferences->'goal') = 'string'
    and jsonb_typeof(preferences->'language') = 'string'
    and jsonb_typeof(preferences->'explanation') = 'string'
    and not (preferences @> '{"familiarity":null}'::jsonb or preferences @> '{"goal":null}'::jsonb or preferences @> '{"language":null}'::jsonb or preferences @> '{"explanation":null}'::jsonb)
  ),
  -- Store explicit consent receipt in the authenticated write endpoint.
  consent_version text not null check (consent_version = 'learning-profile-v1'),
  consented_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  check (expires_at > updated_at and expires_at <= updated_at + interval '30 days'),
  primary key (owner_id, conversation_id)
);
create index learner_profile_expiry on public.learner_profiles(expires_at);
alter table public.learner_profiles enable row level security;
revoke all on public.learner_profiles from anon, authenticated;
grant select, insert, update, delete on public.learner_profiles to authenticated;
create policy learner_read on public.learner_profiles for select to authenticated
  using ((select auth.uid()) = owner_id and expires_at > now());
create policy learner_insert on public.learner_profiles for insert to authenticated
  with check ((select auth.uid()) = owner_id and updated_at <= now() and consented_at <= now() and expires_at > now() and expires_at <= now() + interval '30 days');
create policy learner_update on public.learner_profiles for update to authenticated
  using ((select auth.uid()) = owner_id and expires_at > now())
  with check ((select auth.uid()) = owner_id and updated_at <= now() and consented_at <= now() and expires_at > now() and expires_at <= now() + interval '30 days');
create policy learner_delete on public.learner_profiles for delete to authenticated
  using ((select auth.uid()) = owner_id);
commit;
-- Configure and verify daily expiry deletion separately in the deployment environment.
-- Test owner A/owner B/anon allow+deny for all operations before production.
