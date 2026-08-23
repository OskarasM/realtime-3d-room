import { SnapshotBuffer } from './interpolation'
import trace from '../data/packet-trace.json'

/**
 * Replay a recorded packet stream through the app's real buffer.
 *
 * The site has to make its argument with no Supabase connection at all. Somebody
 * opening it when the free project is paused, or when nobody else is in the
 * room, must still see what interpolation is for. So the comparison runs on
 * src/data/packet-trace.json, which is a genuine recording of one client
 * walking a circuit at 10 Hz as received by a second client on the same
 * channel, and it feeds that recording into the same SnapshotBuffer the live
 * room uses. Nothing here reimplements the thing it is demonstrating.
 *
 * Extra delay and packet loss are added on top of the recording rather than
 * baked into it, because they are the two variables worth dragging. The
 * recording itself was clean: two clients on an idle channel lost nothing at
 * all. Loss showed up in the spike only under the aggregate load of eight
 * clients, at 9.2 per cent, which is where the slider's default sits.
 */

export type Packet = { seq: number; t: number; x: number; z: number; ry: number }

export type Trace = {
  recordedAt: string
  note: string
  hz: number
  sent: number
  received: number
  deliveredPct: number
  interArrivalMs: { p50: number; p95: number; max: number }
  packets: Packet[]
}

export const packetTrace = trace as Trace

/**
 * Where the recording gets back to where it started.
 *
 * The walk is a closed circuit, but the recording stops mid-lap, so looping the
 * whole file would teleport the avatar on every wrap and put a jump into both
 * panes that has nothing to do with interpolation. Rather than hard-code the
 * lap length from the recorder, find the last packet that is back at the
 * opening pose and loop there. Self-describing, and it survives a re-record
 * with a different path.
 */
function findLoopPoint(packets: Packet[]): number {
  const first = packets[0]
  if (!first) return 0
  for (let i = packets.length - 1; i > 1; i--) {
    const p = packets[i]!
    if (Math.abs(p.x - first.x) < 0.05 && Math.abs(p.z - first.z) < 0.05) return i
  }
  return packets.length - 1
}

const LOOP_AT = findLoopPoint(packetTrace.packets)
const LOOP_MS = packetTrace.packets[LOOP_AT]?.t ?? 1

/**
 * Deterministic loss, keyed on the packet's own sequence number.
 *
 * Not Math.random(). Dragging the loss slider should change which packets are
 * missing, not reshuffle the whole stream every frame, and a reader who sets it
 * back to 9 per cent should see the same stream they saw before.
 */
function isDropped(seq: number, lossPct: number): boolean {
  if (lossPct <= 0) return false
  return (Math.imul(seq + 1, 2654435761) >>> 8) % 100 < lossPct
}

export type ReplayOptions = { extraDelayMs: number; lossPct: number }

export type ReplayStats = {
  /** Packets offered by the recording since the replay started. */
  offered: number
  /** Packets that reached the buffer. */
  delivered: number
  /** Gap between consecutive arrivals, over the last few seconds. */
  p50: number
  p95: number
}

/**
 * One replay: a cursor over the recording, one SnapshotBuffer, and the arrival
 * statistics that come out of actually running it.
 *
 * Both panes on the page read this single buffer. `sample()` draws the player
 * RENDER_DELAY_MS in the past between the two packets either side of that
 * moment; `sampleRaw()` jumps to the newest packet. Same data, same buffer, one
 * method call apart, which is the entire point of the section.
 */
export class Replay {
  readonly buffer = new SnapshotBuffer()

  private cursor = 0
  private originMs = 0
  private lapOffsetMs = 0
  private started = false
  private offered = 0
  private delivered = 0
  /** Arrival times of accepted packets, trimmed to the recent window. */
  private arrivals: number[] = []

  /** Start, or start again from the beginning of the recording. */
  reset(now: number): void {
    this.cursor = 0
    this.originMs = now
    this.lapOffsetMs = 0
    this.started = true
    this.offered = 0
    this.delivered = 0
    this.arrivals = []
  }

  /**
   * Advance the recording to `now`, pushing every packet whose moment has come.
   *
   * Called from one requestAnimationFrame loop, not from React. Eighty state
   * updates a second through a store would re-render the page to move two dots.
   */
  pump(now: number, options: ReplayOptions): void {
    if (!this.started) this.reset(now)

    const packets = packetTrace.packets
    const elapsed = now - this.originMs

    // A guard, not a loop condition: if the tab was backgrounded for a minute
    // we should catch up, but pushing six hundred packets in one frame is not
    // catching up, it is a stall.
    let budget = 240

    while (budget-- > 0) {
      const packet = packets[this.cursor]
      if (!packet) break
      const due = this.lapOffsetMs + packet.t + options.extraDelayMs
      if (due > elapsed) break

      this.cursor++
      this.offered++

      if (this.cursor > LOOP_AT) {
        this.cursor = 0
        this.lapOffsetMs += LOOP_MS
      }

      if (isDropped(packet.seq, options.lossPct)) continue

      this.delivered++
      this.arrivals.push(now)
      this.buffer.push({ x: packet.x, z: packet.z, ry: packet.ry, t: now })
    }

    // Five seconds of arrivals is enough for a stable p95 at 10 Hz and short
    // enough that dragging a slider shows up within a second or two.
    const cutoff = now - 5000
    let drop = 0
    while (drop < this.arrivals.length && this.arrivals[drop]! < cutoff) drop++
    if (drop > 0) this.arrivals.splice(0, drop)
  }

  stats(): ReplayStats {
    const gaps: number[] = []
    for (let i = 1; i < this.arrivals.length; i++) {
      gaps.push(this.arrivals[i]! - this.arrivals[i - 1]!)
    }
    gaps.sort((a, b) => a - b)
    const at = (q: number) =>
      gaps.length === 0 ? 0 : Math.round(gaps[Math.min(gaps.length - 1, Math.floor(q * gaps.length))]!)

    return {
      offered: this.offered,
      delivered: this.delivered,
      p50: at(0.5),
      p95: at(0.95),
    }
  }
}
