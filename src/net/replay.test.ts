import { describe, expect, it } from 'vitest'
import { packetTrace, Replay } from './replay'

/**
 * The replay is what makes every measured claim on the site survive a paused
 * Supabase project, so it is worth checking that it actually replays: that it
 * delivers packets on a clock, drops the ones it says it dropped, and keeps
 * going once the recording runs out.
 */
describe('the recorded trace', () => {
  it('is a real recording with packets in it', () => {
    expect(packetTrace.packets.length).toBeGreaterThan(100)
    expect(packetTrace.hz).toBe(10)
    expect(packetTrace.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('has monotonic arrival times', () => {
    for (let i = 1; i < packetTrace.packets.length; i++) {
      expect(packetTrace.packets[i]!.t).toBeGreaterThanOrEqual(packetTrace.packets[i - 1]!.t)
    }
  })

  it('never leaves the room', () => {
    for (const p of packetTrace.packets) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.z)).toBe(true)
      expect(Math.abs(p.x)).toBeLessThanOrEqual(6)
      expect(Math.abs(p.z)).toBeLessThanOrEqual(6)
    }
  })
})

describe('Replay', () => {
  const clean = { extraDelayMs: 0, lossPct: 0 }

  it('delivers nothing before the clock has moved', () => {
    const replay = new Replay()
    replay.pump(1000, clean)
    // The first packet is at t=0, so exactly one has come due.
    expect(replay.stats().delivered).toBe(1)
  })

  it('delivers roughly ten packets a second with no loss', () => {
    const replay = new Replay()
    replay.reset(0)
    for (let now = 0; now <= 3000; now += 16) replay.pump(now, clean)

    const { delivered, offered } = replay.stats()
    expect(delivered).toBe(offered)
    // 3 seconds at 10 Hz, give or take the recording's own jitter.
    expect(delivered).toBeGreaterThan(25)
    expect(delivered).toBeLessThan(35)
  })

  it('holds packets back when extra delay is added', () => {
    const early = new Replay()
    early.reset(0)
    const late = new Replay()
    late.reset(0)

    for (let now = 0; now <= 1000; now += 16) {
      early.pump(now, clean)
      late.pump(now, { extraDelayMs: 300, lossPct: 0 })
    }

    expect(late.stats().delivered).toBeLessThan(early.stats().delivered)
    expect(late.stats().delivered).toBeGreaterThan(0)
  })

  it('drops about the share of packets the loss setting asks for', () => {
    const replay = new Replay()
    replay.reset(0)
    for (let now = 0; now <= 20000; now += 16) replay.pump(now, { extraDelayMs: 0, lossPct: 30 })

    const { offered, delivered } = replay.stats()
    const lost = ((offered - delivered) / offered) * 100
    expect(lost).toBeGreaterThan(20)
    expect(lost).toBeLessThan(40)
  })

  // Dragging the slider should change which packets are missing, not reshuffle
  // the stream. Two replays with the same settings must agree exactly.
  it('drops the same packets every time for the same setting', () => {
    const run = () => {
      const replay = new Replay()
      replay.reset(0)
      for (let now = 0; now <= 5000; now += 16) replay.pump(now, { extraDelayMs: 0, lossPct: 12 })
      return replay.stats()
    }
    expect(run()).toEqual(run())
  })

  it('loops past the end of the recording instead of stopping', () => {
    const replay = new Replay()
    replay.reset(0)
    const lastPacketAt = packetTrace.packets[packetTrace.packets.length - 1]!.t

    for (let now = 0; now <= lastPacketAt * 2; now += 16) replay.pump(now, clean)

    // More packets delivered than the recording holds means it wrapped.
    expect(replay.stats().delivered).toBeGreaterThan(packetTrace.packets.length)
    expect(replay.buffer.sample(lastPacketAt * 2)).not.toBeNull()
  })

  it('reports an inter-arrival p50 in the region the recording was made at', () => {
    const replay = new Replay()
    replay.reset(0)
    for (let now = 0; now <= 6000; now += 16) replay.pump(now, clean)

    const { p50 } = replay.stats()
    expect(p50).toBeGreaterThan(60)
    expect(p50).toBeLessThan(180)
  })
})
