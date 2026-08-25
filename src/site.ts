// Everything on the page that is a fact about this project rather than a fact
// about the layout. Kept apart so the sections stay presentational and the two
// sibling sites can copy a section without dragging this repo's strings along.

export const REPO_URL = 'https://github.com/OskarasM/realtime-3d-room'
export const SOURCE = (path: string) => `${REPO_URL}/blob/main/${path}`

export const BRAND = ['realtime-3d-', 'room'] as const

export const NAV = [
  { href: '#pipeline', label: 'How' },
  { href: '#presence', label: 'Presence' },
  { href: '#interpolation', label: 'Delay' },
  { href: '#policy', label: 'Policy' },
  { href: '#run', label: 'Run it' },
] as const

export const SIBLING_SITES = [
  { href: 'https://three-dispose-guard.vercel.app', label: 'three-dispose-guard' },
  { href: 'https://scene-narrator-demo.vercel.app', label: 'scene-narrator' },
] as const

/**
 * The eight-client figures come from the spike, which is the only place they
 * can come from: two clients on an idle channel lose nothing, and the loss that
 * matters only appears under the aggregate load of a full room.
 */
export const SPIKE = {
  clients: 8,
  deliveredPct: 90.8,
  p50: 109,
  p95: 121.6,
  lossPct: 9.2,
} as const

export const formatMs = (ms: number) => `${Math.round(ms)} ms`
