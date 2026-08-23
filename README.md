<img src="public/favicon.svg" alt="" width="52" height="52" />

# realtime-3d-room

A shared 3D room. Open the URL, you are in it. Open it again in a second window
and there are two of you, moving in real time.

React Three Fiber draws the room. Supabase Realtime carries everyone else. One
guestbook table in Postgres is the only thing that survives you closing the tab,
and a Row Level Security policy is all that protects it.

**[Live demo](https://realtime-3d-room.vercel.app)** . **[The interpolation code](src/net/interpolation.ts)** . **[The spike](spike/RESULTS.md)**

The demo is two browser windows side by side. That is genuinely all it is, and
the site under the canvas walks through the measurements that decided the shape
of it. Every section of that page works with no connection at all, because an
empty room and a paused free project are both ordinary states for it to be in.

## This one is not on npm, and should not be

Its two siblings are libraries and both publish. This is an application, and it
has no importable surface: there is no component you could mount in your own
project without also adopting a Supabase channel, a Zustand store and a room.
Publishing it would be publishing a folder.

The two parts that are genuinely reusable are
[`src/net/interpolation.ts`](src/net/interpolation.ts), the snapshot buffer, and
[`spike/rate-probe.ts`](spike/rate-probe.ts), the measurement harness. Between
them they are about two hundred lines, and they are two hundred lines you should
read and adapt rather than depend on. A dependency you would have to read anyway
is worse than a file you copied and understood.

---

## Why this exists

Most multiplayer tutorials show you a working room and skip the part where it
did not work. This one is written the other way round. The three things that
were actually difficult get a section each:

1. Supabase presence **cannot** carry position, and the reason is a hard limit
   rather than a tuning problem.
2. Sending position ten times a second and drawing it on arrival looks awful.
   There is a toggle in the demo so you can see how awful.
3. Row Level Security is the only thing standing between a public API key and
   your table, and its failure mode for `update` and `delete` is silence rather
   than an error.

Every number below came from `npm run spike` run against a real free plan
project. Nothing here is estimated. The raw output is in
[spike/RESULTS.md](spike/RESULTS.md).

---

## Run it yourself

About ten minutes, most of it waiting for Supabase to provision.

```bash
git clone https://github.com/OskarasM/realtime-3d-room
cd realtime-3d-room
npm install
cp .env.example .env
```

Then:

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
   The free plan is enough.
2. **Project Settings, API Keys.** Copy the project URL and the publishable key
   (`sb_publishable_...`, called the anon key on older projects) into `.env`.
   That key belongs in a browser bundle. The secret key never does.
3. **Authentication, Sign In / Providers, Anonymous sign-ins: on.** Nobody
   should have to make an account to look at a room.
4. **SQL Editor.** Paste in
   [`supabase/migrations/0001_guestbook.sql`](supabase/migrations/0001_guestbook.sql)
   and run it.
5. `npm run dev`, then open the URL in two windows.

If something is missing, the app tells you which step you skipped rather than
showing a black screen.

```bash
npm run dev           # develop
npm test              # unit suite: interpolation, packet validation, replay
npm run test:browser  # Playwright, including axe at WCAG 2 A and AA
npm run check         # typecheck, prose, font budget, unit tests, build
npm run spike         # measure your own project
npm run record        # rewrite the two recordings the site replays
npm run build         # production build
```

`npm run spike` and `npm run record` both point at whatever is in your `.env`
and both send a lot of messages on purpose, so use a project you do not mind
rate limiting. The spike takes a couple of minutes; the recorder takes about
two, most of it sitting in a presence timeout deliberately.

---

## Part one: presence cannot carry position

Supabase Realtime gives you two ways to send something to everyone in a channel,
and the obvious choice is the wrong one.

**Presence** tracks who is in a channel. Each client calls `track()` with some
state, everyone receives a `sync` event, and when somebody's connection dies the
server removes them automatically. That last part is the valuable bit: leave
handling is genuinely hard and presence does it for you.

So put the player's position in the presence payload and call `track()` as they
move. The state is already replicated to everyone. It is one line.

It does not work, and here is the number that says so:

| Limit | Free | Pro |
| --- | --- | --- |
| Presence calls per client, per 30 seconds | **5** | **5** |

Five calls per thirty seconds is **one update every six seconds**. That is not a
tick rate you can tune down to, and note the column on the right: paying does not
move it. It is the same on every plan.

The spike confirms it exactly. Twelve `track()` calls, 400 ms apart:

```
5 of 12 acknowledged, first failure at call 6, over 75093 ms
```

Five succeeded. The sixth failed. The limit is precisely what the documentation
says it is.

The elapsed time is the part that is easy to miss. Twelve calls spaced 400 ms
apart should take under five seconds, and it took **seventy five**. A rejected
`track()` does not return an error promptly, it hangs until the client times out.
So position-on-presence is not a design that merely updates too slowly. It is a
design that stalls for ten seconds at a time, and the server logs
`ClientPresenceRateLimitReached` while it does.

### The split

Presence is not the wrong tool, it is the wrong tool *for position*. So the app
uses both channels of communication for the thing each is good at:

| | Carries | Rate | Why |
| --- | --- | --- | --- |
| **Presence** | Who you are: id, name, colour | Once, at join | Reliable roster, automatic cleanup on disconnect |
| **Broadcast** | Where you are: `x`, `z`, `ry` | 10 per second | No per-client call limit, and losing one does not matter |

Identity changes once. Position changes constantly. They were never the same
kind of data, and the rate limit is what forces you to notice.

### How fast can broadcast actually go?

The documented free plan allowance is 100 messages per second. Measured, one
client sending as fast as it could:

| Send rate | Acknowledged | Websocket |
| --- | --- | --- |
| 10 Hz | 100% | alive |
| 100 Hz | 100% | alive |
| 200 Hz | 100% | alive |

Every send acknowledged at 200 Hz, socket intact. That is worth reporting
honestly and worth being careful about: it does **not** mean you may send at
200 Hz. The quota is per project rather than per client, these were three second
bursts rather than sustained load, and the aggregate result below behaves very
differently. A single client sending briefly is simply not what that limit is
aimed at.

So the tick rate comes from a budget rather than from the ceiling:

```
100 messages/sec (project) / 10 Hz per player = 10 simultaneous players
```

The room caps at **8**, leaving headroom for presence and guestbook traffic. Over
capacity the app says so, because Supabase force-drops connections that push a
project past its throughput and being told is better than being disconnected.

---

## Part two: why naive position updates look terrible

Ten updates a second sounds like plenty. The screen refreshes sixty times a
second, so five out of every six frames have no new information in them.

Draw each packet the moment it lands and the other player teleports ten times a
second. **Open the demo and turn "Interpolation" off in the panel to see it.**
It is not subtle.

It gets worse, because packets do not arrive politely spaced. Eight clients at
10 Hz for twelve seconds, measured:

```
763 of ~840 expected messages delivered (90.8%)
inter-arrival p50 109 ms, p95 121.6 ms
```

Two things there. **About one packet in eleven never arrived at all**, at 80
messages a second aggregate, which is *under* the documented 100. And the gaps
between packets vary: a nominal 100 ms stream arriving with a median gap of
109 ms and a 95th percentile of 121.6 ms.

So the naive approach gives you a player who teleports, occasionally teleports
further because a packet vanished, and does it on an irregular rhythm.

### What interpolation actually fixes

The fix is to stop drawing the newest packet, and instead **draw where the player
was a moment ago**.

Keep the last couple of seconds of positions. Render each remote player as they
were `RENDER_DELAY_MS` in the past. Because that moment is in the past, you hold
packets on *both sides* of it, so you can interpolate between two known
positions rather than guessing at one:

```
packets:   A-------B-------C-------D          (arriving, 10 Hz, jittery)
                       ^
                   render here, 120 ms back
                   between B and C, both of which we hold
```

The delay is 120 ms: one full packet interval at 10 Hz, plus 20 ms of slack. That
was chosen before the spike ran, and the measurement landed almost exactly on it
(p95 inter-arrival was 121.6 ms), which is the right place for it to sit. Lower
it and jitter opens gaps the buffer cannot fill. Raise it and players visibly
trail their own actions.

A lost packet stops being a jump and becomes a slightly longer interpolation
between the two either side of it. Nobody sees it. That 9.2 per cent loss rate is
invisible, and it is invisible *by design* rather than by luck.

Three details in [`interpolation.ts`](src/net/interpolation.ts) that matter more
than they look:

**Timestamps are ours, not the sender's.** Every snapshot is stamped with our own
`performance.now()` on arrival. We are not reconstructing when the sender moved,
only replaying what arrived at the rate it arrived, so there is no clock
synchronisation between browsers anywhere in this project. Clock sync is a large
problem and this design simply never has it.

**We hold rather than extrapolate.** When the render time runs past the newest
packet, because somebody stopped moving or their connection hiccuped, the player
freezes at their last known pose. Predicting forward on their last velocity looks
smoother right up until they turn, at which point they walk through a wall and
snap back. Freezing is honest.

**Angles interpolate the short way round.** Turning from 350 degrees to 10 degrees
should pass through zero, not spin 340 degrees backwards through 180. This is one
line and a
[test](src/net/interpolation.test.ts), and it is the sort of thing that looks
like a physics bug for an hour.

### Why none of this touches React state

Eight players at 10 Hz is eighty updates a second. Put those in a Zustand store
and React re-renders the tree eighty times a second in order to move some boxes.

So the app splits state by *how often it changes*:

| State | Lives in | Changes |
| --- | --- | --- |
| Who is in the room | Zustand | On join and leave |
| Where they are | A plain `Map` outside React | 80 times a second |

[`RemotePlayer`](src/scene/RemotePlayer.tsx) renders **once**, when somebody
joins. After that `useFrame` reads the snapshot buffer and writes straight to the
Three.js object. React is never told anybody moved, because React does not need
to know, and telling it is how you spend a frame budget on reconciliation instead
of pixels.

This is the general rule for R3F, not a trick for this project: anything changing
at frame rate belongs in a ref or a module, never in state.

---

## Part three: the guestbook, and what RLS really does

Everything above vanishes when you close the tab. The guestbook is the one thing
that persists, which makes it the one thing that has to be defended, because the
key that reaches it is sitting in a public JavaScript bundle where anyone can
read it.

That is fine, and it is the part people get wrong. The publishable key is not a
secret. It identifies your project and nothing more. **Row Level Security is the
actual security boundary**, and without it that key is a public write handle to
your database.

```sql
create table public.guestbook (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  name      text not null check (char_length(trim(name)) between 1 and 24),
  colour    text not null check (colour ~ '^#[0-9a-fA-F]{6}$'),
  signed_at timestamptz not null default now()
);

alter table public.guestbook enable row level security;

create policy "guestbook is world readable"
  on public.guestbook for select to anon, authenticated using (true);

create policy "you may sign only as yourself"
  on public.guestbook for insert to authenticated
  with check ((select auth.uid()) = user_id);
```

Four things are doing work here, and only two of them are policies.

**`user_id` as the primary key** is the rule "one signature per visitor". Enforced
in the client that would be a suggestion; here a second tab, a refresh and a
hand-written `fetch` all fail identically.

**`enable row level security`** is the line that matters most. Without it every
policy below is decoration and the table is open to anyone with the key.

**`with check (auth.uid() = user_id)`** is what stops you signing as somebody
else. Anonymous sign-in gives every visitor a real `auth.uid()`, so the policy has
something to check without anyone creating an account.

**The absence of `update` and `delete` policies** is what makes the guestbook
append only. RLS denies anything no policy allows, so writing no code is how that
rule is enforced.

### Watching it hold

Do not take my word for it. The demo has a **"Try signing as someone else"**
button that runs a genuine hostile insert from your browser. Here is the same
thing run directly against Postgres as an authenticated user:

| Attempt | Result |
| --- | --- |
| Insert as yourself | Allowed |
| Insert as another `user_id` | `42501` new row violates row-level security policy |
| Update someone else's row | **0 rows affected, no error** |
| Delete your own row | **0 rows affected, no error** |
| Insert `colour` as `'red'` | `23514` violates check constraint |

The middle two are the ones to internalise. **A blocked `update` or `delete` does
not raise an error. It reports success and affects zero rows**, because with no
policy granting access there are simply no rows visible to modify. Code that
checks only for an error thinks the delete worked.

An insert is different, because there is a row being offered for inspection and
`with check` rejects it outright. Same protection, two completely different
shapes, and only one of them shows up in your error handler.

---

## Measured numbers

Free plan, `eu-west-1`, domestic UK connection, 21 August 2026. Yours will
differ. Run `npm run spike` and find out.

| Measurement | Result |
| --- | --- |
| Broadcast round trip, p50 | 27 ms |
| Broadcast round trip, p95 | 33.3 ms |
| Broadcast round trip, max | 46 ms |
| `track()` calls acknowledged out of 12 | **5**, first failure at call 6 |
| Time those 12 calls took | 75 seconds |
| 8 clients at 10 Hz, delivered | 90.8% |
| Inter-arrival gap, p50 / p95 | 109 / 121.6 ms |
| Single client send rate with 100% acks | 200 Hz (in 3 second bursts) |

### One hazard the spike found by accident

`realtime-js` prints this when you call `send()` on a channel whose socket is not
joined:

```
Realtime send() is automatically falling back to REST API.
```

It does not throw. Every message quietly becomes an individual HTTP POST. An app
sending position ten times a second keeps *appearing* to work while issuing ten
HTTP requests a second per player. Sequence your sends after `SUBSCRIBED` and
watch for that line.

Also worth knowing if you are porting an older tutorial: the client side
`realtime: { params: { eventsPerSecond } }` throttle **no longer exists** in
`@supabase/supabase-js` 2.112. There are zero references to it in the package.
Budgeting your send rate is now entirely your job, which is why
[`protocol.ts`](src/net/protocol.ts) does the arithmetic in comments.

---

## What was deliberately left out

This is a presence demo, not a game engine. Cut on purpose:

- **No authoritative server.** Every client is trusted with its own position. The
  worst available exploit is standing somewhere silly, and the room stays a room.
  Anything competitive needs a server, and that is a month of work, not a weekend.
- **No reconciliation, prediction or rollback.** Your own movement is local and
  immediate; everyone else is a replay. That asymmetry is the whole trick and it
  is why none of the hard netcode is here.
- **No server-side room cap.** The eight-person limit is enforced by each client
  untracking itself, which means it is courtesy rather than a control. A scripted
  client can ignore it entirely and keep broadcasting, and enough of those would
  push the project past the free plan's 100 messages a second and start getting
  everyone disconnected. Enforcing it properly needs Realtime Authorisation with
  an RLS policy on `realtime.messages`, so the server refuses the join rather
  than the client declining it.
- **No validation of what a remote client claims about itself.** Inbound
  positions are checked for shape and finiteness and clamped to the room in
  [`parseMove`](src/net/protocol.ts), which is enough to stop a bad packet
  removing an avatar permanently. It is not enough to stop someone teleporting:
  that needs a server that knows where you were last tick.
- **No accounts, chat, or uploaded avatars.** Name and colour are derived from
  your anonymous user id.
- **No private channels.** The room is public. Locking one down means Realtime
  Authorisation and RLS policies on `realtime.messages`, which is the natural next
  step if you want a private room.
- **Shadows.** A dark disc under each player instead of a shadow map, which is the
  first thing to cost you frames on a mid-range phone and which nobody notices at
  this scale.

## Stack

React 19, TypeScript, Vite, React Three Fiber, drei, Zustand, Vitest,
Playwright with axe, Supabase (Realtime, anonymous Auth, Postgres with RLS),
deployed on Vercel.

No CSS framework. The site is one token file, one shared chrome stylesheet and
one of its own, which between them are smaller than the utility classes they
replaced. Type is four self-hosted subset faces at 103.6 kB, checked against a
150 kB ceiling in CI, and never fetched from a font CDN: a page that argues
about what arrives over the wire should be able to account for all of it.

## Licence

MIT. Clone it, point it at your own Supabase project, take it somewhere.

---

## Related

Three repositories, one design system, three different hard parts of production
WebGL.

- [three-dispose-guard](https://github.com/OskarasM/three-dispose-guard) - GPU
  resource ownership and lifetime. Collection is not disposal, and unmount is not
  ownership. [Site](https://three-dispose-guard.vercel.app)
- [scene-narrator](https://github.com/OskarasM/scene-narrator) - accessibility
  under continuous motion. What a screen reader gets from a moving 3D scene, which
  is otherwise nothing. [Site](https://scene-narrator-inky.vercel.app)

## Type licensing

The four faces in [`public/fonts`](public/fonts) are SIL Open Font License 1.1
and their licence text ships beside them: Commit Mono, Atkinson Hyperlegible
Next and Anybody. They are subset to latin and to the axis ranges this site
actually sets.
