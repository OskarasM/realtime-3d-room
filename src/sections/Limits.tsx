import { Band } from '../ui/Band'
import { ROOM_CAPACITY, TICK_HZ } from '../net/protocol'
import { SOURCE } from '../site'

const LIMITS = [
  {
    title: 'No authoritative server',
    body: 'Every client is trusted with its own position. Inbound packets are checked for shape and finiteness and clamped to the room, which stops a bad one removing an avatar permanently, but nothing here can tell the difference between walking and teleporting. Doing that properly means a server that knows where you were last tick, and that is a month of work rather than a weekend.',
  },
  {
    title: 'The room cap is courtesy, not a control',
    body: `${ROOM_CAPACITY} is enforced by each client untracking itself when it finds it is over the line. A scripted client can ignore that entirely and keep broadcasting. Enforcing it properly needs Realtime Authorisation with a policy on realtime.messages, so the server refuses the join rather than the client declining it.`,
  },
  {
    title: 'The free plan is the real ceiling',
    body: `100 messages a second across the whole project, 20 presence messages a second, five presence calls per client per thirty seconds. Everyone in the room sends ${TICK_HZ} a second, which is what sets the cap at ${ROOM_CAPACITY} rather than at whatever the floor could hold.`,
  },
  {
    title: 'No reconciliation, prediction or rollback',
    body: 'Your own movement is local and immediate; everyone else is a replay. That asymmetry is the whole trick, and it is why none of the hard netcode is here. It also means a dropped packet is smoothed over rather than corrected, because there is nothing authoritative to correct against.',
  },
  {
    title: 'No shadows, no post-processing',
    body: 'A dark disc under each player instead of a shadow map. Shadow maps mean an extra depth pass every frame, which is the first thing to cost you frames on a mid-range phone, and at this scale nobody can tell.',
  },
  {
    title: 'The room is public',
    body: 'One channel, one lobby, no private rooms and no accounts. Locking a room down means Realtime Authorisation and RLS policies on realtime.messages, which is the natural next step rather than a missing piece.',
  },
] as const

export function Limits() {
  return (
    <Band
      id="limits"
      mark="honest"
      title="What this is not"
      lede={
        <>
          A presence demo, not a game engine, and an application rather than a package. The list
          below is the one worth reading before you borrow anything from here.
        </>
      }
    >
      <div className="limits">
        {LIMITS.map((limit) => (
          <article key={limit.title}>
            <h3>{limit.title}</h3>
            <p>{limit.body}</p>
          </article>
        ))}
      </div>

      <div className="npm-note">
        <h3>This one is not on npm, and should not be</h3>
        <p>
          Its two siblings are libraries and both publish to npm. This is an application, and it has
          no importable surface: there is no component you could mount in your own project without
          also adopting a Supabase channel, a Zustand store and a room. Publishing it would be
          publishing a folder.
        </p>
        <p>
          The two parts that are genuinely reusable are{' '}
          <a href={SOURCE('src/net/interpolation.ts')}>src/net/interpolation.ts</a>, which is the
          snapshot buffer, and <a href={SOURCE('spike/rate-probe.ts')}>spike/rate-probe.ts</a>, which
          is the measurement harness. Between them they are about two hundred lines, and they are
          two hundred lines you should read and adapt rather than depend on. A dependency you would
          have to read anyway is worse than a file you copied and understood.
        </p>
      </div>
    </Band>
  )
}
