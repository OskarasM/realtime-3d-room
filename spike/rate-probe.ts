/**
 * The feasibility spike.
 *
 * Everything in this project rests on one question: can Supabase Realtime carry
 * position updates fast enough that movement looks like movement? The docs give
 * you the plan limits. They do not tell you what actually happens when you walk
 * into them, and a guide that quotes numbers nobody ran is just a nicer looking
 * guess.
 *
 * So this connects real clients to a real project and measures four things:
 *
 *   1. Broadcast round trip time, using self-broadcast so both timestamps come
 *      off the same clock and no clock synchronisation is involved.
 *   2. The send rate at which acknowledgements start failing.
 *   3. What presence does when you exceed 5 track() calls in 30 seconds.
 *   4. What a full room of ROOM_CAPACITY clients at TICK_HZ actually costs.
 *
 * Run it with:
 *   npm run spike
 *
 * It needs the same .env the app uses, and it writes a markdown block at the
 * end that goes straight into the README.
 *
 * It sends a lot of messages on purpose. Point it at a project you do not mind
 * rate limiting, and expect the tail phases to take a couple of minutes.
 */
import 'dotenv/config'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { ROOM_CAPACITY, TICK_HZ } from '../src/net/protocol'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

if (!URL || !KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env first.')
  process.exit(1)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Percentiles = { p50: number; p95: number; max: number; n: number }

function percentiles(values: number[]): Percentiles {
  if (values.length === 0) return { p50: NaN, p95: NaN, max: NaN, n: 0 }
  const s = [...values].sort((a, b) => a - b)
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))]!
  return { p50: at(0.5), p95: at(0.95), max: s[s.length - 1]!, n: s.length }
}

const r1 = (n: number) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : NaN)

/**
 * Count the REST fallback instead of letting it scroll past.
 *
 * This is the most surprising thing the spike found. When a client goes over
 * the throughput limit the server drops its socket, and realtime-js does not
 * throw: it quietly starts POSTing each message to the REST endpoint instead,
 * one HTTP request per position update. Your app keeps "working" and gets
 * slower and more expensive without a single error. We count the warnings so
 * the effect is a number rather than a wall of text.
 */
let restFallbacks = 0
const realWarn = console.warn.bind(console)
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('falling back to REST')) {
    restFallbacks++
    return
  }
  realWarn(...args)
}

/** True while the websocket is genuinely usable for pushes. */
function canPush(ch: RealtimeChannel): boolean {
  const adapter = (ch as unknown as { channelAdapter?: { canPush?: () => boolean } }).channelAdapter
  return adapter?.canPush?.() ?? false
}

let warnedAboutAuth = false

/**
 * A connected client.
 *
 * We try to sign in anonymously, because that is what the app does, but we do
 * not insist on it. This channel is public, so the transport we are measuring
 * works with the publishable key alone, and refusing to measure because an auth
 * provider is switched off would be measuring the dashboard rather than
 * Realtime. If sign in fails we carry on with a synthetic id and say so once.
 */
async function newClient(): Promise<{ sb: SupabaseClient; id: string }> {
  const sb = createClient(URL!, KEY!, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInAnonymously()
  if (error || !data.user) {
    if (!warnedAboutAuth) {
      warnedAboutAuth = true
      console.warn(
        `   (anonymous sign in unavailable: ${error?.message ?? 'no user'}. Measuring the public channel unauthenticated.)`,
      )
    }
    return { sb, id: `anon-${Math.random().toString(36).slice(2, 10)}` }
  }
  return { sb, id: data.user.id }
}

function join(sb: SupabaseClient, topic: string, opts: { ack?: boolean; self?: boolean } = {}) {
  return new Promise<RealtimeChannel>((resolve, reject) => {
    const ch = sb.channel(topic, {
      config: { broadcast: { ack: opts.ack ?? false, self: opts.self ?? false } },
    })
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
// 1. Round trip time
// ---------------------------------------------------------------------------

async function measureRtt(samples = 120, hz = TICK_HZ): Promise<Percentiles> {
  const { sb } = await newClient()
  // self: true means the server echoes our own broadcast back to us, so both
  // ends of the measurement are stamped by one clock. Comparing a send time on
  // one machine with a receive time on another would be measuring clock skew.
  const ch = await join(sb, 'spike:rtt', { self: true })

  const sentAt = new Map<number, number>()
  const rtt: number[] = []
  ch.on('broadcast', { event: 'ping' }, ({ payload }) => {
    const t0 = sentAt.get(payload.seq as number)
    if (t0 !== undefined) rtt.push(performance.now() - t0)
  })

  for (let seq = 0; seq < samples; seq++) {
    sentAt.set(seq, performance.now())
    void ch.send({ type: 'broadcast', event: 'ping', payload: { seq } })
    await sleep(1000 / hz)
  }
  await sleep(1500)

  await sb.removeAllChannels()
  return percentiles(rtt)
}

// ---------------------------------------------------------------------------
// 2. Where acknowledgements start failing
// ---------------------------------------------------------------------------

type RateStep = {
  hz: number
  sent: number
  ok: number
  failed: number
  okPct: number
  /** Was the websocket still usable at the end of this step? */
  socketAlive: boolean
  /** Sends that silently degraded to an HTTP POST during this step. */
  restFallbacks: number
}

async function findSendCeiling(): Promise<RateStep[]> {
  const { sb } = await newClient()
  // ack: true is the whole point here. Without it send() resolves 'ok' the
  // instant the frame is written and tells you nothing about whether the
  // server took it. The app runs without ack; a measurement cannot.
  const ch = await join(sb, 'spike:rate', { ack: true })

  const steps: RateStep[] = []
  for (const hz of [10, 20, 40, 60, 80, 100, 140, 200]) {
    const seconds = 3
    const results: string[] = []
    const fallbacksBefore = restFallbacks
    const started = performance.now()

    for (let i = 0; i < hz * seconds; i++) {
      const due = started + (i * 1000) / hz
      const wait = due - performance.now()
      if (wait > 0) await sleep(wait)
      results.push(
        await ch.send({ type: 'broadcast', event: 'burst', payload: { i, pad: 'x'.repeat(48) } }),
      )
    }

    const ok = results.filter((r) => r === 'ok').length
    const step: RateStep = {
      hz,
      sent: results.length,
      ok,
      failed: results.length - ok,
      okPct: Math.round((ok / results.length) * 1000) / 10,
      socketAlive: canPush(ch),
      restFallbacks: restFallbacks - fallbacksBefore,
    }
    steps.push(step)
    console.log(
      `   ${String(hz).padStart(3)} Hz: ${step.okPct}% acknowledged, socket ${step.socketAlive ? 'alive' : 'DROPPED'}` +
        (step.restFallbacks > 0 ? `, ${step.restFallbacks} sends silently went over REST` : ''),
    )

    // Once the socket is gone or most sends are failing there is nothing more
    // to learn from going faster.
    if (step.okPct < 50 || !step.socketAlive) break
    await sleep(1500) // let any window-based limiter drain
  }

  await sb.removeAllChannels()
  return steps
}

// ---------------------------------------------------------------------------
// 3. The presence wall
// ---------------------------------------------------------------------------

type PresenceResult = { attempts: number; ok: number; firstFailureAt: number | null; elapsedMs: number }

async function probePresenceLimit(): Promise<PresenceResult> {
  const { sb, id } = await newClient()
  const ch = await join(sb, 'spike:presence')

  const started = performance.now()
  let ok = 0
  let firstFailureAt: number | null = null
  const attempts = 12 // the documented allowance is 5 per client per 30 seconds

  for (let i = 0; i < attempts; i++) {
    const res = await ch.track({ id, i, at: Date.now() })
    if (res === 'ok') ok++
    else if (firstFailureAt === null) firstFailureAt = i + 1
    await sleep(400) // all twelve land comfortably inside one 30 second window
  }

  const elapsedMs = performance.now() - started
  await sb.removeAllChannels()
  return { attempts, ok, firstFailureAt, elapsedMs }
}

// ---------------------------------------------------------------------------
// 4. A full room
// ---------------------------------------------------------------------------

type RoomResult = {
  clients: number
  hz: number
  seconds: number
  sent: number
  received: number
  expected: number
  deliveredPct: number
  gap: Percentiles
}

async function simulateFullRoom(clients = ROOM_CAPACITY, hz = TICK_HZ, seconds = 12): Promise<RoomResult> {
  const conns = await Promise.all(Array.from({ length: clients }, () => newClient()))
  const chans = await Promise.all(conns.map((c) => join(c.sb, 'spike:room')))

  let received = 0
  const gaps: number[] = []
  const lastFrom = new Map<string, number>()

  // Only one client listens and counts. Every client listening would multiply
  // inbound traffic by the number of clients and measure our own test harness
  // rather than the service.
  chans[0]!.on('broadcast', { event: 'move' }, ({ payload }) => {
    received++
    const from = payload.id as string
    const now = performance.now()
    const prev = lastFrom.get(from)
    if (prev !== undefined) gaps.push(now - prev)
    lastFrom.set(from, now)
  })

  await sleep(500)

  let sent = 0
  const timers = conns.map((c, i) =>
    setInterval(() => {
      sent++
      void chans[i]!.send({
        type: 'broadcast',
        event: 'move',
        payload: { id: c.id, x: Math.sin(sent / 10) * 8, z: Math.cos(sent / 10) * 8, ry: 0 },
      })
    }, 1000 / hz),
  )

  await sleep(seconds * 1000)
  timers.forEach(clearInterval)
  await sleep(1200)

  // Client 0 hears everybody except itself.
  const expected = Math.round((clients - 1) * hz * seconds)
  const result: RoomResult = {
    clients,
    hz,
    seconds,
    sent,
    received,
    expected,
    deliveredPct: Math.round((received / expected) * 1000) / 10,
    gap: percentiles(gaps),
  }

  await Promise.all(conns.map((c) => c.sb.removeAllChannels()))
  return result
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`Probing ${URL}\n`)

  console.log('1. Broadcast round trip, self-echo, 120 samples at 10 Hz')
  const rtt = await measureRtt()
  console.log(`   p50 ${r1(rtt.p50)} ms, p95 ${r1(rtt.p95)} ms, max ${r1(rtt.max)} ms, ${rtt.n} returned\n`)

  console.log('2. Send rate ceiling, acknowledged sends, one client')
  const steps = await findSendCeiling()
  console.log('')

  console.log('3. Presence call limit, 12 track() calls in under 6 seconds')
  const presence = await probePresenceLimit()
  console.log(
    `   ${presence.ok} of ${presence.attempts} acknowledged, first failure at call ${presence.firstFailureAt ?? 'none'}, over ${Math.round(presence.elapsedMs)} ms\n`,
  )

  console.log(`4. Full room, ${ROOM_CAPACITY} clients at ${TICK_HZ} Hz for 12 seconds`)
  const room = await simulateFullRoom()
  console.log(
    `   ${room.received} of ~${room.expected} expected messages delivered (${room.deliveredPct}%), inter-arrival p50 ${r1(room.gap.p50)} ms, p95 ${r1(room.gap.p95)} ms\n`,
  )

  const lastGood = [...steps].reverse().find((s) => s.okPct >= 99)

  console.log('--- paste into the README ---\n')
  console.log(`Measured on ${new Date().toISOString().slice(0, 10)} against a free plan project.`)
  console.log('')
  console.log('| Measurement | Result |')
  console.log('| --- | --- |')
  console.log(`| Broadcast round trip, p50 | ${r1(rtt.p50)} ms |`)
  console.log(`| Broadcast round trip, p95 | ${r1(rtt.p95)} ms |`)
  console.log(`| Highest fully acknowledged send rate, one client | ${lastGood ? `${lastGood.hz} Hz` : 'below 10 Hz'} |`)
  console.log(`| track() calls acknowledged out of ${presence.attempts} in ${Math.round(presence.elapsedMs / 1000)} s | ${presence.ok} |`)
  console.log(`| ${room.clients} clients at ${room.hz} Hz, messages delivered | ${room.deliveredPct}% |`)
  console.log(`| Inter-arrival gap at ${room.hz} Hz, p50 / p95 | ${r1(room.gap.p50)} / ${r1(room.gap.p95)} ms |`)
  console.log('')
  console.log('Send rate ramp, one client:')
  console.log('')
  console.log('| Send rate | Acknowledged | Websocket | Silent REST fallbacks |')
  console.log('| --- | --- | --- | --- |')
  for (const s of steps) {
    console.log(`| ${s.hz} Hz | ${s.okPct}% | ${s.socketAlive ? 'alive' : 'dropped'} | ${s.restFallbacks} |`)
  }
  console.log('')
  console.log(`Total sends that silently degraded to an HTTP POST during the whole run: ${restFallbacks}.`)
  console.log('')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSpike failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
