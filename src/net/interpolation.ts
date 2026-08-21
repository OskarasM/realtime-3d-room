import { BUFFER_KEEP_MS, RENDER_DELAY_MS } from './protocol'

export type Snapshot = {
  x: number
  z: number
  ry: number
  /** Local receive time in ms (performance.now()). Never the sender's clock. */
  t: number
}

export type Sample = { x: number; z: number; ry: number }

/** Shortest-arc interpolation between two angles in radians. */
export function lerpAngle(a: number, b: number, k: number): number {
  const twoPi = Math.PI * 2
  let d = (b - a) % twoPi
  if (d > Math.PI) d -= twoPi
  if (d < -Math.PI) d += twoPi
  return a + d * k
}

/**
 * A short history of where one remote player has been, replayed slightly late.
 *
 * The naive version of multiplayer sets the other player's position the instant
 * a packet lands. At 10 Hz that is a teleport ten times a second, and it looks
 * exactly as bad as it sounds. Instead we keep the last couple of seconds of
 * snapshots and draw the player where they were RENDER_DELAY_MS ago, which is a
 * moment we hold data on both sides of, so we can interpolate rather than guess.
 *
 * Snapshots are stamped with our own clock at the moment they arrive. That
 * deliberately avoids any clock synchronisation between browsers: we are not
 * trying to reconstruct when the sender moved, only to replay what we received
 * at the rate we received it.
 */
export class SnapshotBuffer {
  private buf: Snapshot[] = []

  push(s: Snapshot): void {
    const last = this.buf[this.buf.length - 1]
    if (last && s.t < last.t) {
      // Out of order arrival. Rare over a websocket, but cheap to be correct about.
      const i = this.buf.findIndex((e) => e.t > s.t)
      this.buf.splice(i, 0, s)
    } else {
      this.buf.push(s)
    }
    this.trim(s.t)
  }

  private trim(now: number): void {
    const cutoff = now - BUFFER_KEEP_MS
    let drop = 0
    // Keep at least one snapshot older than the cutoff, so we can always straddle it.
    while (drop + 2 < this.buf.length && this.buf[drop + 1]!.t < cutoff) drop++
    if (drop > 0) this.buf.splice(0, drop)
  }

  get latest(): Snapshot | undefined {
    return this.buf[this.buf.length - 1]
  }

  get size(): number {
    return this.buf.length
  }

  /**
   * Where should this player be drawn right now?
   *
   * `now` is a performance.now() reading. Returns null only when we have never
   * heard from this player at all.
   */
  sample(now: number): Sample | null {
    const renderTime = now - RENDER_DELAY_MS
    const buf = this.buf
    if (buf.length === 0) return null
    if (buf.length === 1) return flat(buf[0]!)

    const newest = buf[buf.length - 1]!
    // Render time has run past our newest packet: the sender stopped moving, or
    // the connection hiccuped. Hold the last known pose rather than extrapolating.
    // ponytail: freezing is honest and cannot overshoot. Add dead reckoning
    // (project forward along the last velocity) only if the stall becomes visible.
    if (renderTime >= newest.t) return flat(newest)

    const oldest = buf[0]!
    // Render time is behind everything we hold, which happens for the first
    // RENDER_DELAY_MS after somebody joins. Show them at their first position.
    if (renderTime <= oldest.t) return flat(oldest)

    let i = buf.length - 1
    while (i > 0 && buf[i - 1]!.t > renderTime) i--
    const b = buf[i]!
    const a = buf[i - 1]!

    const span = b.t - a.t
    const k = span <= 0 ? 1 : (renderTime - a.t) / span
    return {
      x: a.x + (b.x - a.x) * k,
      z: a.z + (b.z - a.z) * k,
      ry: lerpAngle(a.ry, b.ry, k),
    }
  }

  /**
   * The same data with no interpolation at all: jump straight to the newest
   * packet. This is the failure case, kept so the README and the demo can show
   * it rather than describe it.
   */
  sampleRaw(): Sample | null {
    const newest = this.latest
    return newest ? flat(newest) : null
  }
}

function flat(s: Snapshot): Sample {
  return { x: s.x, z: s.z, ry: s.ry }
}
