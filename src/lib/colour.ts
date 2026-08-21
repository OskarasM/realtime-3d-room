/**
 * Everyone needs a name and a colour, and nobody should have to fill in a form
 * to get one. Both are derived from the anonymous auth user id, so they are
 * stable for as long as the session lasts and identical on every client that
 * sees you. No profile table, no upload, no settings screen.
 */

const ADJECTIVES = [
  'brisk', 'candid', 'dappled', 'eager', 'flinty', 'genial', 'hazy', 'idle',
  'jaunty', 'keen', 'lucid', 'mellow', 'nimble', 'ochre', 'plucky', 'quiet',
  'rugged', 'sanguine', 'tawny', 'unruly', 'vivid', 'wistful', 'zealous',
]

const NOUNS = [
  'auk', 'badger', 'curlew', 'dormouse', 'egret', 'ferret', 'gannet', 'heron',
  'ibis', 'jackdaw', 'kestrel', 'lapwing', 'marten', 'newt', 'otter', 'puffin',
  'quail', 'raven', 'stoat', 'tern', 'vole', 'wren', 'yaffle',
]

/** FNV-1a. Small, fast, and good enough to spread ids across the word lists. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function nameFor(id: string): string {
  const h = hash(id)
  const adj = ADJECTIVES[h % ADJECTIVES.length]!
  const noun = NOUNS[Math.floor(h / ADJECTIVES.length) % NOUNS.length]!
  return `${adj} ${noun}`
}

/**
 * Hue from the id, but saturation and lightness fixed, so every colour sits in
 * the same band and reads clearly against the floor. Random RGB would hand
 * somebody near-black and they would be invisible.
 */
export function colourFor(id: string): string {
  const hue = hash(id + ':colour') % 360
  return hslToHex(hue, 68, 58)
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
