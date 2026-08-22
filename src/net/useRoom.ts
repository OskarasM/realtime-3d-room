import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { configError, isConfigured, supabase } from '../lib/supabase'
import { colourFor, nameFor } from '../lib/colour'
import { useRoomStore } from '../state/useRoomStore'
import { bufferFor, forgetEveryone, forgetPlayer, localPose } from './motion'
import {
  CHANNEL,
  MOVE_EVENT,
  POSITION_EPSILON,
  parseMove,
  ROOM_CAPACITY,
  SEND_INTERVAL_MS,
  type MovePayload,
  type PresenceMeta,
} from './protocol'

/** Resend even when standing still, so somebody who just joined can see you. */
const KEEPALIVE_MS = 2000

/**
 * The whole network layer. One channel, two jobs.
 *
 *   presence  -> who is in the room. Rare, reliable, cleans up on disconnect.
 *   broadcast -> where they are. Ten times a second, fire and forget.
 *
 * They are separate because Supabase rate limits them separately, and presence
 * is limited to five calls per client per thirty seconds. That is one update
 * every six seconds, so presence physically cannot carry position. See the
 * README for the arithmetic.
 */
export function useRoom(): void {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const store = useRoomStore.getState()

    if (!isConfigured) {
      store.setStatus('error', configError)
      return
    }

    let channel: RealtimeChannel | null = null
    let sendTimer: ReturnType<typeof setInterval> | null = null
    let statsTimer: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    const counters = { out: 0, in: 0, bad: 0 }
    const lastSent = { x: NaN, z: NaN, ry: NaN, at: 0 }

    async function connect() {
      store.setStatus('connecting')

      const user = await signIn()
      if (!user || cancelled) return

      const me: PresenceMeta = {
        id: user,
        name: nameFor(user),
        colour: colourFor(user),
        joinedAt: Date.now(),
      }
      useRoomStore.getState().setMe(me)

      channel = supabase.channel(CHANNEL, {
        config: {
          // Keying presence by user id means a reconnect replaces your entry
          // rather than leaving a ghost of you standing in the room.
          presence: { key: me.id },
        },
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          if (!channel) return
          const state = channel.presenceState<PresenceMeta>()
          const roster: Record<string, PresenceMeta> = {}
          for (const [key, entries] of Object.entries(state)) {
            const meta = entries[0]
            if (meta) roster[key] = meta
          }
          useRoomStore.getState().setRoster(roster)
          enforceCapacity(roster, me)
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          // Drop their snapshot history too, or a rejoin interpolates from
          // wherever they were standing when they left.
          forgetPlayer(key)
        })
        .on('broadcast', { event: MOVE_EVENT }, ({ payload }) => {
          const move = parseMove(payload)
          // Refused packets are counted separately. A client sending rubbish
          // should show up as a number on the HUD rather than as an avatar
          // that silently stopped moving.
          if (!move) {
            counters.bad++
            return
          }
          if (move.id === me.id) return
          counters.in++
          bufferFor(move.id).push({
            x: move.x,
            z: move.z,
            ry: move.ry,
            // Our clock, not theirs. We never synchronise clocks between
            // browsers; we only replay what arrived, at the rate it arrived.
            t: performance.now(),
          })
        })

      channel.subscribe((status, err) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          void channel?.track(me)
          useRoomStore.getState().setStatus('ready')
        } else if (status === 'CHANNEL_ERROR') {
          useRoomStore
            .getState()
            .setStatus('error', err?.message ?? 'The realtime channel would not open.')
        } else if (status === 'TIMED_OUT') {
          useRoomStore.getState().setStatus('error', 'The realtime connection timed out.')
        }
      })

      sendTimer = setInterval(() => sendMove(me.id), SEND_INTERVAL_MS)
      statsTimer = setInterval(() => {
        useRoomStore.getState().setStats({ ...counters })
        counters.out = 0
        counters.in = 0
        counters.bad = 0
      }, 1000)
    }

    function sendMove(id: string) {
      if (!channel || useRoomStore.getState().status !== 'ready') return

      const moved =
        Math.abs(localPose.x - lastSent.x) > POSITION_EPSILON ||
        Math.abs(localPose.z - lastSent.z) > POSITION_EPSILON ||
        Math.abs(localPose.ry - lastSent.ry) > POSITION_EPSILON

      const now = performance.now()
      // Standing still costs nothing except one keepalive every two seconds,
      // which is what lets a late joiner see where you are before you move.
      if (!moved && now - lastSent.at < KEEPALIVE_MS) return

      lastSent.x = localPose.x
      lastSent.z = localPose.z
      lastSent.ry = localPose.ry
      lastSent.at = now

      const payload: MovePayload = {
        id,
        // Two decimal places is about a centimetre in this room, and it keeps
        // the payload small. Nobody can see the difference.
        x: round(localPose.x),
        z: round(localPose.z),
        ry: round(localPose.ry),
      }

      // Fire and forget, deliberately.
      //
      // The channel is configured without broadcast ack, which means send()
      // resolves 'ok' the moment the frame is written rather than when the
      // server has taken it. That is the right trade here: a position from 200
      // ms ago is worth less than no position, so there is nothing useful to do
      // with a failure except send the next, newer one. spike/rate-probe.ts
      // turns ack on, because measuring is exactly the case where you do want
      // to wait for the answer.
      void channel.send({ type: 'broadcast', event: MOVE_EVENT, payload })
      counters.out++
    }

    /**
     * Eight is the cap because the free plan allows 100 messages a second
     * across the whole project and everyone in here sends 10. Supabase
     * force-drops connections that push a project past its throughput, so
     * saying "full" is strictly kinder than being disconnected mid-sentence.
     *
     * Overflow clients untrack, which takes them out of presence entirely. That
     * means the "am I over the cap" test has to change once you are out, or you
     * would fall out of the roster, look under the cap again, rejoin, and flap
     * forever.
     */
    function enforceCapacity(roster: Record<string, PresenceMeta>, me: PresenceMeta) {
      const current = useRoomStore.getState().status

      if (current === 'full') {
        // Not tracked, so we are not in the roster. Everyone we can see is
        // somebody else. Rejoin the moment there is a space.
        if (Object.keys(roster).length < ROOM_CAPACITY) {
          void channel?.track(me)
          useRoomStore.getState().setStatus('ready')
        }
        return
      }

      // Ordered by join time, so the room fills first come first served rather
      // than by whoever happens to reconnect fastest.
      // ponytail: joinedAt is each client's own Date.now(), so a badly set
      // clock could jump the queue. Fair ordering needs a server timestamp,
      // which needs a server. Not worth it for a lobby of eight.
      const order = Object.values(roster).sort((a, b) => a.joinedAt - b.joinedAt)
      if (order.findIndex((p) => p.id === me.id) >= ROOM_CAPACITY) {
        void channel?.untrack()
        useRoomStore.getState().setStatus('full')
      }
    }

    void connect()

    return () => {
      cancelled = true
      started.current = false
      if (sendTimer) clearInterval(sendTimer)
      if (statsTimer) clearInterval(statsTimer)
      if (channel) {
        void channel.untrack()
        void supabase.removeChannel(channel)
      }
      forgetEveryone()
    }
  }, [])
}

async function signIn(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.user) return session.user.id

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.user) {
    useRoomStore
      .getState()
      .setStatus(
        'error',
        `Anonymous sign in failed: ${error?.message ?? 'no user returned'}. Enable it under Authentication, Sign In / Providers, Anonymous sign-ins.`,
      )
    return null
  }
  return data.user.id
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
