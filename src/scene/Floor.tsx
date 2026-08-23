import { Grid } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { ROOM_HALF } from '../net/protocol'

const WALL_H = 1.6
const WALL_T = 0.25

/**
 * The room. A floor you can tap, a grid so movement is legible, and four low
 * walls so the space reads as a place rather than an infinite plane.
 *
 * The tap handler is the entire mobile control scheme. A phone with no keyboard
 * gets a move target from one pointer event on a mesh that had to exist anyway,
 * which beats building a joystick nobody asked for.
 */
export function Floor({ onTap }: { onTap: (x: number, z: number) => void }) {
  const handle = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onTap(e.point.x, e.point.z)
  }

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onPointerDown={handle}>
        <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
        <meshStandardMaterial color="#121b26" roughness={0.95} metalness={0} />
      </mesh>

      <Grid
        args={[ROOM_HALF * 2, ROOM_HALF * 2]}
        position={[0, 0.005, 0]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#263646"
        sectionSize={3}
        sectionThickness={1.1}
        sectionColor="#3c6472"
        fadeDistance={30}
        fadeStrength={1}
        infiniteGrid={false}
      />

      {(
        [
          [0, -ROOM_HALF, ROOM_HALF * 2, WALL_T],
          [0, ROOM_HALF, ROOM_HALF * 2, WALL_T],
          [-ROOM_HALF, 0, WALL_T, ROOM_HALF * 2],
          [ROOM_HALF, 0, WALL_T, ROOM_HALF * 2],
        ] as const
      ).map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, WALL_H / 2, z]}>
          <boxGeometry args={[w, WALL_H, d]} />
          <meshStandardMaterial color="#1b2733" roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}
