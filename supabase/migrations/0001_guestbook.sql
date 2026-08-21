-- The one thing in this project that survives a refresh.
--
-- Run this in the Supabase SQL editor, or with the Supabase CLI:
--   supabase db push
--
-- Everything else in the room is presence and broadcast, which live only as
-- long as the websocket does. This table is the piece that has to be defended,
-- because the key that reaches it is sitting in a public JavaScript bundle.

create table if not exists public.guestbook (
  -- The primary key IS the rule "one signature per visitor". Enforcing that in
  -- the client would be a suggestion; enforcing it here makes a second tab, a
  -- refresh and a hand-written fetch all fail the same way.
  user_id   uuid primary key references auth.users (id) on delete cascade,
  name      text not null check (char_length(trim(name)) between 1 and 24),
  colour    text not null check (colour ~ '^#[0-9a-fA-F]{6}$'),
  signed_at timestamptz not null default now()
);

create index if not exists guestbook_signed_at_idx
  on public.guestbook (signed_at desc);

-- Without this line every policy below is decoration and the table is wide
-- open to anybody holding the publishable key.
alter table public.guestbook enable row level security;

drop policy if exists "guestbook is world readable" on public.guestbook;
create policy "guestbook is world readable"
  on public.guestbook
  for select
  to anon, authenticated
  using (true);

drop policy if exists "you may sign only as yourself" on public.guestbook;
create policy "you may sign only as yourself"
  on public.guestbook
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- There is deliberately no update policy and no delete policy.
--
-- RLS denies anything a policy does not explicitly allow, so the absence of
-- those two policies is what makes the guestbook append only. Nobody can edit
-- or remove an entry, including their own, without a service role key that
-- never leaves the server. Writing no code is how that rule is enforced.

-- Try this in the SQL editor with the anon role to watch it hold:
--
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001"}';
--   insert into public.guestbook (user_id, name, colour)
--   values ('00000000-0000-4000-8000-000000000002', 'not me', '#ff0000');
--
--   ERROR: new row violates row-level security policy for table "guestbook"
