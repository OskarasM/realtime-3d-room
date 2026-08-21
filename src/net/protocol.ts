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
