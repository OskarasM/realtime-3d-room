import { useCallback, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Floor } from './Floor'
import { LocalPlayer, type TapTarget } from './LocalPlayer'
import { RemotePlayer } from './RemotePlayer'
import { useOccupants, useRoomStore } from '../state/useRoomStore'

export function Room({ frameloop = 'always' }: { frameloop?: 'always' | 'never' }) {
  const me = useRoomStore((s) => s.me)
  const occupants = useOccupants()
  const [target, setTarget] = useState<TapTarget>(null)

  const clearTarget = useCallback(() => setTarget(null), [])
  const tap = useCallback((x: number, z: number) => setTarget({ x, z }), [])

  return (
    <Canvas
      // Paused once the stage has scrolled off screen. A WebGL scene that keeps
      // drawing while nobody is looking at it is spending someone's battery to
      // produce nothing, and this page argues about frame budget.
      frameloop={frameloop}
      // Capping device pixel ratio is the single highest value line in this
      // file for mobile. A modern phone reports 3, which means rendering nine
      // times the pixels of a 1x buffer for a scene made of capsules.
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      // Lets R3F drop resolution rather than frames if the device struggles.
      performance={{ min: 0.5 }}
      camera={{ position: [0, 9, 11], fov: 46, near: 0.1, far: 90 }}
    >
      <color attach="background" args={['#070a10']} />
      <fog attach="fog" args={['#070a10', 16, 42]} />

      {/* No shadow maps anywhere. See Avatar for what stands in for them. */}
      <ambientLight intensity={0.75} />
      <directionalLight position={[7, 12, 6]} intensity={1.15} />
      <directionalLight position={[-8, 6, -5]} intensity={0.35} color="#6ea8ff" />

      <Floor onTap={tap} />
      {target ? <TapMarker x={target.x} z={target.z} /> : null}

      {me ? <LocalPlayer colour={me.colour} target={target} clearTarget={clearTarget} /> : null}

      {occupants
        .filter((p) => p.id !== me?.id)
        .map((p) => (
          <RemotePlayer key={p.id} player={p} />
        ))}

      <OrbitControls
        target={[0, 0.6, 0]}
        enablePan={false}
        minDistance={6}
        maxDistance={20}
        minPolarAngle={0.35}
        maxPolarAngle={1.35}
        // Keeping the camera roughly behind the room means W stays "away from
        // me" on screen. Movement is world relative, so letting the camera swing
        // all the way round would quietly invert the controls.
        minAzimuthAngle={-Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
        makeDefault
      />

      <FpsMeter />
    </Canvas>
  )
}

function TapMarker({ x, z }: { x: number; z: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.03, z]}>
      <ringGeometry args={[0.22, 0.3, 24]} />
      <meshBasicMaterial color="#35e0f0" transparent opacity={0.8} depthWrite={false} />
    </mesh>
  )
}

/** Frames counted in a ref, published to the store once a second. */
function FpsMeter() {
  const frames = useRef(0)
  const since = useRef(performance.now())

  useFrame(() => {
    frames.current++
    const now = performance.now()
    const elapsed = now - since.current
    if (elapsed < 1000) return
    useRoomStore.getState().setStats({ fps: Math.round((frames.current * 1000) / elapsed) })
    frames.current = 0
    since.current = now
  })

  return null
}
