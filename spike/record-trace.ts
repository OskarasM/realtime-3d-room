/**
 * Record the two datasets the site replays.
 *
 * Every section of the demo site has to work with no Supabase connection at
 * all. An employer opening it when the room is empty, or when the free project
 * has been paused, must still see the whole argument. So the two sections that
 * make measured claims replay real recordings instead of making live calls,
 * and this is what produces them.
 *
 *   src/data/rate-probe.json    what presence does past its call allowance
 *   src/data/packet-trace.json  a real 10 Hz walk, as it actually arrived
 *
 * Run it with:
 *   npm run record
 *
 * It needs the same .env the app uses, and it takes about two minutes, most of
 * which is phase one sitting in a presence timeout on purpose.
 */
import 'dotenv/config'
import { writeFileSync, mkdirSync } from 'node:fs'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { SEND_INTERVAL_MS, TICK_HZ } from '../src/net/protocol'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

if (!URL || !KEY) {
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env first.',
  )
  process.exit(1)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const r2 = (n: number) => Math.round(n * 100) / 100
const r3 = (n: number) => Math.round(n * 1000) / 1000

async function newClient(): Promise<{ sb: SupabaseClient; id: string }> {
  const sb = createClient(URL!, KEY!, { auth: { persistSession: false } })
  const { data } = await sb.auth.signInAnonymously()
  return { sb, id: data?.user?.id ?? `anon-${Math.random().toString(36).slice(2, 10)}` }
}

function join(sb: SupabaseClient, topic: string, self = false) {
  return new Promise<RealtimeChannel>((resolve, reject) => {
    const ch = sb.channel(topic, { config: { broadcast: { ack: false, self } } })
    const timer = setTimeout(() => reject(new Error(`Timed out joining ${topic}`)), 15_000)
    ch.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve(ch)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(err ?? new Error(status))
      }
    })
  })
}

// ---------------------------------------------------------------------------
// 1. The presence wall, call by call
// ---------------------------------------------------------------------------

/**
 * The spike already reports that five of twelve track() calls succeed. It
 * reports it as a summary, which loses half the finding: the failures do not
 * fail fast, they hang. Recording each call's own duration is what lets the
 * site draw the result to scale, where a minute of mostly waiting is visible
 * rather than described.
 */
async function recordPresence() {
  const { sb, id } = await newClient()
  const ch = await join(sb, 'record:presence')

  const attempts = 12
  const calls: { call: number; startedMs: number; durationMs: number; result: string }[] = []
  const t0 = performance.now()

  for (let i = 0; i < attempts; i++) {
    const started = performance.now()
    const result = await ch.track({ id, i, at: Date.now() })
    const ended = performance.now()
    calls.push({
      call: i + 1,
      startedMs: Math.round(started - t0),
      durationMs: Math.round(ended - started),
      result: String(result),
    })
    process.stdout.write(`   call ${i + 1}: ${result} in ${Math.round(ended - started)} ms\n`)
    await sleep(400)
  }

  await sb.removeAllChannels()

  const ok = calls.filter((c) => c.result === 'ok').length
  return {
    recordedAt: new Date().toISOString().slice(0, 10),
    note: 'Twelve track() calls, 400 ms apart, on one client. The documented allowance is five per client per thirty seconds.',
    attempts,
    ok,
    firstFailureAt: calls.find((c) => c.result !== 'ok')?.call ?? null,
    totalMs: Math.round(performance.now() - t0),
    calls,
  }
}

// ---------------------------------------------------------------------------
// 2. A real walk, as it actually arrived
// ---------------------------------------------------------------------------

const LAP = 8 // side of the square circuit, in world units
const SPEED = 4.2 // the app's walking speed
const PAUSE = 1.5 // seconds spent standing still at the first corner each lap

/**
 * A square circuit with a pause at one corner.
 *
 * Deliberately not a smooth curve. The corners are where drawing a packet the
 * instant it lands and drawing it 120 ms late look most different, and the
 * pause is there so the trace also contains the case where nothing changes.
 */
function pathAt(tSec: number): { x: number; z: number; ry: number } {
  const side = LAP / SPEED
  const lap = side * 4 + PAUSE
  let t = tSec % lap
  const half = LAP / 2

  if (t < PAUSE) return { x: -half, z: -half, ry: 0 }
  t -= PAUSE

  const leg = Math.floor(t / side)
  const d = ((t % side) / side) * LAP
  switch (leg) {
    case 0:
      return { x: -half + d, z: -half, ry: Math.atan2(1, 0) }
    case 1:
      return { x: half, z: -half + d, ry: Math.atan2(0, 1) }
    case 2:
      return { x: half - d, z: half, ry: Math.atan2(-1, 0) }
    default:
      return { x: -half, z: half - d, ry: Math.atan2(0, -1) }
  }
}

async function recordTrace(seconds = 32) {
  const sender = await newClient()
  const receiver = await newClient()
  const topic = `record:trace:${Math.random().toString(36).slice(2, 8)}`

  const send = await join(sender.sb, topic)
  const recv = await join(receiver.sb, topic)

  type Packet = { seq: number; t: number; x: number; z: number; ry: number }
  const arrived: Packet[] = []
  let firstArrival: number | null = null

  recv.on('broadcast', { event: 'move' }, ({ payload }) => {
    const now = performance.now()
    if (firstArrival === null) firstArrival = now
    arrived.push({
      seq: payload.seq as number,
      t: Math.round(now - firstArrival),
      x: r2(payload.x as number),
      z: r2(payload.z as number),
      ry: r3(payload.ry as number),
    })
  })

  // Let the receiver's subscription settle before the first send, or the
  // opening packets are lost to the join rather than to the network, and the
  // delivery figure below would be measuring the wrong thing.
  await sleep(1000)

  const started = performance.now()
  const total = Math.round(seconds * TICK_HZ)
  for (let seq = 0; seq < total; seq++) {
    const due = started + seq * SEND_INTERVAL_MS
    const wait = due - performance.now()
    if (wait > 0) await sleep(wait)
    const pose = pathAt((performance.now() - started) / 1000)
    void send.send({
      type: 'broadcast',
      event: 'move',
      payload: { seq, x: r2(pose.x), z: r2(pose.z), ry: r3(pose.ry) },
    })
    if (seq % 50 === 0) process.stdout.write(`   sent ${seq}/${total}, ${arrived.length} back\n`)
  }

  await sleep(2000)
  await sender.sb.removeAllChannels()
  await receiver.sb.removeAllChannels()

  const gaps: number[] = []
  for (let i = 1; i < arrived.length; i++) gaps.push(arrived[i]!.t - arrived[i - 1]!.t)
  const sorted = [...gaps].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0

  return {
    recordedAt: new Date().toISOString().slice(0, 10),
    note: "One client walking a square circuit and broadcasting at 10 Hz, recorded by a second client on the same channel. Arrival times are the receiver's own clock, relative to the first packet. No clocks were synchronised.",
    hz: TICK_HZ,
    sent: total,
    received: arrived.length,
    deliveredPct: Math.round((arrived.length / total) * 1000) / 10,
    interArrivalMs: { p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] ?? 0 },
    packets: arrived,
  }
}

async function main() {
  console.log('1. Presence, twelve track() calls')
  const presence = await recordPresence()
  console.log(
    `   ${presence.ok} of ${presence.attempts} acknowledged over ${Math.round(presence.totalMs / 1000)} s\n`,
  )

  console.log('2. A 10 Hz walk, sender and receiver')
  const trace = await recordTrace()
  console.log(
    `   ${trace.received} of ${trace.sent} delivered (${trace.deliveredPct}%), inter-arrival p50 ${trace.interArrivalMs.p50} ms, p95 ${trace.interArrivalMs.p95} ms\n`,
  )

  mkdirSync('src/data', { recursive: true })
  writeFileSync('src/data/rate-probe.json', JSON.stringify(presence, null, 2) + '\n')
  writeFileSync('src/data/packet-trace.json', JSON.stringify(trace) + '\n')
  console.log('Written src/data/rate-probe.json and src/data/packet-trace.json')
  process.exit(0)
}

void main()
