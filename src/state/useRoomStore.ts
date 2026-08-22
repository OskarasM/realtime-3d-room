import { create } from 'zustand'
import type { PresenceMeta } from '../net/protocol'

export type Status = 'booting' | 'connecting' | 'ready' | 'full' | 'error'

export type Stats = {
  /** Broadcasts we sent in the last second. */
  out: number
  /** Broadcasts we received in the last second, from everybody. */
  in: number
  /** Inbound packets refused by parseMove in the last second. */
  bad: number
  fps: number
}

type RoomState = {
  status: Status
  error: string | null
  me: PresenceMeta | null
  /** Everyone else. Keyed by user id, and it changes on join and leave only. */
  roster: Record<string, PresenceMeta>
  /** Off shows the unsmoothed failure case. It is a demo control, not a setting. */
  smoothing: boolean
  stats: Stats

  setStatus: (status: Status, error?: string | null) => void
  setMe: (me: PresenceMeta) => void
  setRoster: (roster: Record<string, PresenceMeta>) => void
  setStats: (stats: Partial<Stats>) => void
  toggleSmoothing: () => void
}

export const useRoomStore = create<RoomState>((set) => ({
  status: 'booting',
  error: null,
  me: null,
  roster: {},
  smoothing: true,
  stats: { out: 0, in: 0, bad: 0, fps: 0 },

  setStatus: (status, error = null) => set({ status, error }),
  setMe: (me) => set({ me }),
  setRoster: (roster) => set({ roster }),
  setStats: (stats) => set((s) => ({ stats: { ...s.stats, ...stats } })),
  toggleSmoothing: () => set((s) => ({ smoothing: !s.smoothing })),
}))

/** Everyone in the room including you, in join order, for stable list rendering. */
export function useOccupants(): PresenceMeta[] {
  const roster = useRoomStore((s) => s.roster)
  return Object.values(roster).sort((a, b) => a.joinedAt - b.joinedAt)
}
