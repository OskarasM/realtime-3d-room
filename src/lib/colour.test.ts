import { describe, expect, it } from 'vitest'
import { colourFor, nameFor } from './colour'

const IDS = Array.from({ length: 500 }, (_, i) => `3f9a${i}-0000-4000-8000-00000000${i}`)

describe('colourFor', () => {
  it('always produces a colour the guestbook check constraint will accept', () => {
    // The Postgres column is: check (colour ~ '^#[0-9a-fA-F]{6}$')
    const pattern = /^#[0-9a-f]{6}$/
    for (const id of IDS) expect(colourFor(id)).toMatch(pattern)
  })

  it('is stable for the same id', () => {
    expect(colourFor(IDS[0]!)).toBe(colourFor(IDS[0]!))
  })
})

describe('nameFor', () => {
  it('is stable, and short enough for the 24 character column limit', () => {
    for (const id of IDS) {
      expect(nameFor(id)).toBe(nameFor(id))
      expect(nameFor(id).length).toBeLessThanOrEqual(24)
    }
  })

  it('spreads ids across the word lists rather than clustering', () => {
    const unique = new Set(IDS.map(nameFor))
    expect(unique.size).toBeGreaterThan(100)
  })
})
