import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { Avatar } from './Avatar'
import { bufferFor } from '../net/motion'
import { useRoomStore } from '../state/useRoomStore'
import type { PresenceMeta } from '../net/protocol'

/**
 * Somebody else.
 *
 * This component renders once, when they join. After that it never re-renders:
 * every frame it reads the snapshot buffer and writes straight to the Three.js
 * object. React is not told that anything moved, because React does not need to
 * know, and telling it eighty times a second is how you lose your frame budget
 * to reconciliation instead of spending it on pixels.
 */
export function RemotePlayer({ player }: { player: PresenceMeta }) {
  const group = useRef<Group>(null)
  const buffer = bufferFor(player.id)

  useFrame(() => {
    const g = group.current
    if (!g) return

    // Reading the store imperatively rather than by subscription, for the same
    // reason: flipping the toggle should not re-render eight avatars.
    const smoothing = useRoomStore.getState().smoothing
    const s = smoothing ? buffer.sample(performance.now()) : buffer.sampleRaw()

    if (!s) {
      // Present but never heard from. Hide rather than parking them at the
      // origin, where they would look like they are standing in the middle.
      g.visible = false
      return
    }

    g.visible = true
    g.position.x = s.x
    g.position.z = s.z
    g.rotation.y = s.ry
  })

  return (
    <group ref={group} visible={false}>
      <Avatar colour={player.colour} />
    </group>
  )
}
