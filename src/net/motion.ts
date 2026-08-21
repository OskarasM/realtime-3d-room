import { SnapshotBuffer } from './interpolation'

/**
 * Motion lives here, outside React, on purpose.
 *
 * Eight players broadcasting at 10 Hz is eighty state updates a second. Put
 * those in a React store and the whole tree re-renders eighty times a second to
 * move some boxes. Instead the roster (who is here, what they are called) lives
 * in Zustand, where it changes on join and leave only, and position lives in
 * this plain module-level Map, which useFrame reads and applies straight to the
 * mesh. React never learns that anybody moved.
 */
export const buffers = new Map<string, SnapshotBuffer>()

export function bufferFor(id: string): SnapshotBuffer {
  let b = buffers.get(id)
  if (!b) {
    b = new SnapshotBuffer()
    buffers.set(id, b)
  }
  return b
}

export function forgetPlayer(id: string): void {
  buffers.delete(id)
}

export function forgetEveryone(): void {
  buffers.clear()
}

/**
 * Where the local player is right now. LocalPlayer writes it every frame, the
 * send loop reads it ten times a second. Same reasoning as above: this changes
 * at 60 Hz and must not touch React.
 */
export const localPose = { x: 0, z: 0, ry: 0 }
