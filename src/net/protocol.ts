/**
 * Everything the two halves of the app have to agree on.
 *
 * The numbers here are not taste. They come out of the Supabase Realtime
 * limits on the free plan, which the README works through in full:
 *
 *   - 100 messages per second, project wide
 *   - 20 presence messages per second, project wide
 *   - 5 presence calls per client per 30 seconds
 *
 * That last one is why position does not travel on presence. Five calls in
 * thirty seconds is one update every six seconds. Position rides on broadcast
 * instead, and presence is left doing the thing it is good at: telling us who
 * is in the room.
 */

/** How often a moving client broadcasts its position. */
export const TICK_HZ = 10
export const SEND_INTERVAL_MS = 1000 / TICK_HZ

/**
 * How far in the past we render other people.
 *
 * At 10 Hz a packet lands every 100 ms. To interpolate between two positions
 * you need both of them, so you can only draw a moment you already have both
 * ends of. Rendering 120 ms behind gives us one full packet interval plus 20 ms
 * of slack for jitter. Lower it and you get gaps; raise it and other people
 * visibly trail their own actions.
 */
export const RENDER_DELAY_MS = 120

/** Drop a snapshot once it is this far behind the newest one. */
export const BUFFER_KEEP_MS = 2000

/**
 * 100 messages per second divided by a 10 Hz tick is 10 simultaneous movers
 * before the project hits the free plan ceiling. We stop at 8 to leave headroom
 * for guestbook signings and presence traffic.
 */
export const ROOM_CAPACITY = 8

/** Below this much movement we do not bother sending. Standing still is free. */
export const POSITION_EPSILON = 0.015

/** One broadcast: where a player is and which way they are facing. */
export type MovePayload = {
  /** Player id, which is the Supabase auth user id. */
  id: string
  x: number
  z: number
  /** Rotation about Y, in radians. */
  ry: number
}

/** What presence carries. Identity only, and it changes almost never. */
export type PresenceMeta = {
  id: string
  name: string
  colour: string
  joinedAt: number
}

export const CHANNEL = 'room:lobby'
export const MOVE_EVENT = 'move'

/**
 * Half-width of the walkable floor, in world units.
 *
 * Deliberately small. An avatar is about 1.2 units tall, so a room much bigger
 * than this renders everyone as specks on an empty plain and the space stops
 * reading as a room. Eight people need somewhere to bump into each other, not
 * a car park.
 */
export const ROOM_HALF = 6

/**
 * How far from the centre a player can stand: the wall, less the avatar's
 * radius. One definition, used by the local clamp and the remote one, because
 * two copies of a bound drift apart and the second one is always the one
 * nobody tested.
 */
export const WALK_LIMIT = ROOM_HALF - 0.6

export function clampPosition(v: number): number {
  return Math.max(-WALK_LIMIT, Math.min(WALK_LIMIT, v))
}

/** Fold any angle into (-PI, PI], so a remote value cannot spin unboundedly. */
export function wrapAngle(r: number): number {
  // Returned untouched when it is already in range, because the modulo below
  // is not exact: it comes back off by a float ulp and every ordinary packet
  // would arrive very slightly rotated.
  if (r > -Math.PI && r <= Math.PI) return r
  const twoPi = Math.PI * 2
  const wrapped = ((r + Math.PI) % twoPi + twoPi) % twoPi
  return wrapped - Math.PI
}

/**
 * Read one inbound broadcast, or refuse it.
 *
 * Everything arriving on this channel comes from another browser holding the
 * same publishable key, so it is untrusted by construction: a hostile client
 * can send any JSON it likes and a buggy one can send NaN. Either goes
 * straight into a Three.js transform, and NaN is the expensive one, because it
 * survives every interpolation it touches afterwards. Once a position is NaN
 * the avatar is gone until the page reloads.
 *
 * This is the only place remote packets enter the app, which is why the check
 * lives here rather than in the handler that happens to have the bug today.
 */
export function parseMove(input: unknown): MovePayload | null {
  if (typeof input !== 'object' || input === null) return null

  const { id, x, z, ry } = input as Record<string, unknown>
  // Supabase user ids are UUIDs; the ceiling is only here so a megabyte of
  // string cannot become a Map key we then keep a snapshot buffer under.
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) return null
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(ry)) return null

  // Clamped rather than rejected. Someone walking out through a wall is a
  // client bug worth drawing at the wall; only unrepresentable numbers are
  // worth dropping the packet for.
  return {
    id,
    x: clampPosition(x as number),
    z: clampPosition(z as number),
    ry: wrapAngle(ry as number),
  }
}
