import { describe, expect, it } from 'vitest'
import { clampPosition, parseMove, WALK_LIMIT, wrapAngle } from './protocol'

describe('parseMove', () => {
  const good = { id: 'a7f1c2d3-0000-4000-8000-000000000001', x: 1.5, z: -2.25, ry: 0.4 }

  it('accepts a well formed packet unchanged', () => {
    expect(parseMove(good)).toEqual(good)
  })

  it('refuses anything that is not an object', () => {
    for (const junk of [null, undefined, 'move', 42, [], true]) {
      expect(parseMove(junk)).toBeNull()
    }
  })

  it('refuses a packet with no usable id', () => {
    expect(parseMove({ ...good, id: '' })).toBeNull()
    expect(parseMove({ ...good, id: 42 })).toBeNull()
    expect(parseMove({ ...good, id: 'x'.repeat(65) })).toBeNull()
  })

  // The one that matters. NaN survives every interpolation it touches, so a
  // single bad packet removes an avatar until the page is reloaded.
  it('refuses NaN and Infinity rather than letting them reach a transform', () => {
    for (const bad of [NaN, Infinity, -Infinity, '3', null]) {
      expect(parseMove({ ...good, x: bad })).toBeNull()
      expect(parseMove({ ...good, z: bad })).toBeNull()
      expect(parseMove({ ...good, ry: bad })).toBeNull()
    }
  })

  it('clamps a position outside the room to the wall', () => {
    const out = parseMove({ ...good, x: 9999, z: -9999 })
    expect(out).not.toBeNull()
    expect(out!.x).toBe(WALK_LIMIT)
    expect(out!.z).toBe(-WALK_LIMIT)
  })

  it('folds a runaway rotation back into one turn', () => {
    const out = parseMove({ ...good, ry: 1000 })
    expect(out!.ry).toBeGreaterThan(-Math.PI)
    expect(out!.ry).toBeLessThanOrEqual(Math.PI)
  })

  it('ignores extra properties instead of forwarding them', () => {
    const out = parseMove({ ...good, admin: true, nested: { a: 1 } })
    expect(Object.keys(out!).sort()).toEqual(['id', 'ry', 'x', 'z'])
  })
})

describe('wrapAngle', () => {
  it('leaves an angle already in range alone', () => {
    expect(wrapAngle(0)).toBeCloseTo(0)
    expect(wrapAngle(1.2)).toBeCloseTo(1.2)
    expect(wrapAngle(-1.2)).toBeCloseTo(-1.2)
  })

  it('wraps a full turn back to itself', () => {
    expect(wrapAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5)
    expect(wrapAngle(-Math.PI * 2 - 0.5)).toBeCloseTo(-0.5)
  })
})

describe('clampPosition', () => {
  it('passes through a position inside the room', () => {
    expect(clampPosition(2)).toBe(2)
  })

  it('holds at the wall in both directions', () => {
    expect(clampPosition(100)).toBe(WALK_LIMIT)
    expect(clampPosition(-100)).toBe(-WALK_LIMIT)
  })
})
