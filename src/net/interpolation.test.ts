import { describe, expect, it } from 'vitest'
import { SnapshotBuffer, lerpAngle } from './interpolation'
import { RENDER_DELAY_MS } from './protocol'

const D = RENDER_DELAY_MS

describe('lerpAngle', () => {
  it('goes the short way round the circle', () => {
    // 350 degrees to 10 degrees should pass through 0, not spin back through 180.
    // Get this wrong and players pirouette every time they cross north.
    const a = (350 * Math.PI) / 180
    const b = (10 * Math.PI) / 180
    const deg = ((lerpAngle(a, b, 0.5) * 180) / Math.PI + 360) % 360
    expect(deg).toBeCloseTo(0, 5)
  })

  it('is the identity at k=0 and reaches the target at k=1', () => {
    expect(lerpAngle(1, 2, 0)).toBeCloseTo(1, 10)
    expect(lerpAngle(1, 2, 1)).toBeCloseTo(2, 10)
  })
})

describe('SnapshotBuffer', () => {
  it('returns null before any packet arrives', () => {
    expect(new SnapshotBuffer().sample(1000)).toBeNull()
  })

  it('interpolates halfway between two snapshots', () => {
    const b = new SnapshotBuffer()
    b.push({ x: 0, z: 0, ry: 0, t: 1000 })
    b.push({ x: 10, z: 20, ry: 0, t: 1100 })
    // now - D = 1050, exactly midway between the two packets.
    const s = b.sample(1050 + D)!
    expect(s.x).toBeCloseTo(5, 6)
    expect(s.z).toBeCloseTo(10, 6)
  })

  it('holds the last pose instead of extrapolating past it', () => {
    const b = new SnapshotBuffer()
    b.push({ x: 0, z: 0, ry: 0, t: 1000 })
    b.push({ x: 10, z: 0, ry: 0, t: 1100 })
    expect(b.sample(5000)!.x).toBe(10)
  })

  it('clamps to the first pose while the render delay is still filling', () => {
    const b = new SnapshotBuffer()
    b.push({ x: 3, z: 4, ry: 0, t: 1000 })
    b.push({ x: 9, z: 4, ry: 0, t: 1100 })
    expect(b.sample(1000)!.x).toBe(3) // render time 880, before anything we hold
  })

  it('sorts a packet that arrives out of order', () => {
    const b = new SnapshotBuffer()
    b.push({ x: 0, z: 0, ry: 0, t: 1000 })
    b.push({ x: 20, z: 0, ry: 0, t: 1200 })
    b.push({ x: 10, z: 0, ry: 0, t: 1100 }) // late arrival
    expect(b.sample(1150 + D)!.x).toBeCloseTo(15, 6)
  })

  it('discards snapshots older than the keep window', () => {
    const b = new SnapshotBuffer()
    for (let t = 0; t <= 6000; t += 100) b.push({ x: t / 100, z: 0, ry: 0, t })
    // Two seconds of history at 10 Hz is about 21 snapshots, not 61.
    expect(b.size).toBeLessThan(25)
    expect(b.latest!.x).toBe(60)
  })

  it('sampleRaw is the failure case: it jumps straight to the newest packet', () => {
    const b = new SnapshotBuffer()
    b.push({ x: 0, z: 0, ry: 0, t: 1000 })
    b.push({ x: 10, z: 0, ry: 0, t: 1100 })
    expect(b.sampleRaw()!.x).toBe(10)
    expect(b.sample(1050 + D)!.x).toBeCloseTo(5, 6)
  })

  it('never moves backwards through a straight run of packets', () => {
    const b = new SnapshotBuffer()
    for (let i = 0; i <= 20; i++) b.push({ x: i, z: 0, ry: 0, t: 1000 + i * 100 })
    let last = -Infinity
    for (let now = 1000; now <= 3000; now += 16) {
      const s = b.sample(now + D)
      if (!s) continue
      expect(s.x).toBeGreaterThanOrEqual(last - 1e-9)
      last = s.x
    }
  })
})
