import { useCallback, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { Avatar } from './Avatar'
import { useKeyboard } from './useKeyboard'
import { localPose } from '../net/motion'
import { clampPosition } from '../net/protocol'
import { lerpAngle } from '../net/interpolation'

const SPEED = 4.2 // world units per second
const TURN_RATE = 12 // how fast the avatar swings round to face travel
const ARRIVE = 0.12

export type TapTarget = { x: number; z: number } | null

/**
 * You. Moved directly, drawn immediately, never interpolated.
 *
 * Your own movement must not go through the network, or it would feel like
 * playing over a 200 ms delay. Everyone else is a replay of packets; you are
 * live. That asymmetry is the whole trick, and it is why this needs no
 * authoritative server: the only thing you can lie about is where your own
 * capsule stands, and the worst outcome is that you stand somewhere silly.
 */
export function LocalPlayer({
  colour,
  target,
  clearTarget,
}: {
  colour: string
  target: TapTarget
  clearTarget: () => void
}) {
  const group = useRef<Group>(null)
  const held = useKeyboard(useCallback(() => clearTarget(), [clearTarget]))

  useFrame((_, rawDelta) => {
    const g = group.current
    if (!g) return

    // A backgrounded tab can hand you a delta of several seconds. Cap it, or
    // you teleport across the room on the first frame back.
    const delta = Math.min(rawDelta, 0.1)

    let dx = 0
    let dz = 0
    const k = held.current
    if (k.up) dz -= 1
    if (k.down) dz += 1
    if (k.left) dx -= 1
    if (k.right) dx += 1

    if (dx !== 0 || dz !== 0) {
      // Normalise, or holding two keys makes you 41 per cent faster diagonally.
      const len = Math.hypot(dx, dz)
      dx /= len
      dz /= len
    } else if (target) {
      const tx = target.x - g.position.x
      const tz = target.z - g.position.z
      const dist = Math.hypot(tx, tz)
      if (dist < ARRIVE) {
        clearTarget()
      } else {
        dx = tx / dist
        dz = tz / dist
      }
    }

    if (dx !== 0 || dz !== 0) {
      g.position.x = clampPosition(g.position.x + dx * SPEED * delta)
      g.position.z = clampPosition(g.position.z + dz * SPEED * delta)
      // Face where you are going. atan2(x, z) because forward is +Z.
      const want = Math.atan2(dx, dz)
      g.rotation.y = lerpAngle(g.rotation.y, want, Math.min(1, TURN_RATE * delta))
    }

    // The send loop reads this ten times a second. It is a plain object rather
    // than React state precisely so that writing to it sixty times a second is
    // free.
    localPose.x = g.position.x
    localPose.z = g.position.z
    localPose.ry = g.rotation.y
  })

  return (
    <group ref={group}>
      <Avatar colour={colour} />
      {/* A ring so you can always find yourself in a crowd. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.62, 0.76, 28]} />
        <meshBasicMaterial color={colour} transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  )
}
