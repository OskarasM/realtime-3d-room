import { useCallback, useRef, useState } from 'react'
import type { Group, Mesh } from 'three'
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

  const hover = useRef({ x: 0, z: 0, over: false })
  const onHover = useCallback((x: number, z: number, over: boolean) => {
    hover.current = { x, z, over }
  }, [])

  return (
    <Canvas
      // Named so the stylesheet can size the wrapper React Three Fiber puts
      // around the canvas. It used to be matched as div:first-child, which is
      // only the canvas wrapper while there is a canvas: on a machine with no
      // WebGL the instrument panels became the first child and inherited a
      // full-bleed width that knocked them off the page's own margin.
      className="stage-gl"
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
      camera={{ position: [0, 7.4, 9.4], fov: 50, near: 0.1, far: 90 }}
    >
      <color attach="background" args={['#070a10']} />
      <fog attach="fog" args={['#070a10', 16, 42]} />

      {/* No shadow maps anywhere. See Avatar for what stands in for them. */}
      <ambientLight intensity={0.95} />
      <directionalLight position={[7, 12, 6]} intensity={1.15} />
      <directionalLight position={[-8, 6, -5]} intensity={0.35} color="#6ea8ff" />

      <Floor onTap={tap} onHover={onHover} />
      <FloorCursor hover={hover} />
      {target ? <TapMarker key={`${target.x},${target.z}`} x={target.x} z={target.z} /> : null}

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

/**
 * Where the pointer is on the floor.
 *
 * The room reads as a place you look at until something under the cursor
 * responds to you, at which point it reads as a place you can walk into. That
 * is the entire job of this ring, and it is why the click marker below is a
 * louder version of the same shape rather than a different idea.
 *
 * Driven from a ref in useFrame, so moving the mouse costs one matrix update
 * rather than a React render.
 */
function FloorCursor({ hover }: { hover: React.RefObject<{ x: number; z: number; over: boolean }> }) {
  const ref = useRef<Group>(null)

  useFrame(({ clock }) => {
    const mesh = ref.current
    const at = hover.current
    if (!mesh || !at) return
    mesh.visible = at.over
    if (!at.over) return
    mesh.position.set(at.x, 0.04, at.z)
    // A slow breath rather than a pulse. It has to say "this is live" without
    // competing with the avatars, which are the things actually moving.
    const breath = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.08
    mesh.scale.setScalar(breath)
  })

  return (
    <group ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <circleGeometry args={[0.09, 20]} />
        <meshBasicMaterial color="#35e0f0" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.3, 0.35, 28]} />
        <meshBasicMaterial color="#35e0f0" transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  )
}

/**
 * Where you asked to go.
 *
 * Two rings: one that holds at the target until you arrive, and one that
 * expands and fades once, so the click has an acknowledgement of its own. The
 * component is keyed on the position, so tapping somewhere else replays it.
 */
function TapMarker({ x, z }: { x: number; z: number }) {
  const pulse = useRef<Mesh>(null)
  const born = useRef(0)

  useFrame(({ clock }) => {
    const mesh = pulse.current
    if (!mesh) return
    if (born.current === 0) born.current = clock.elapsedTime

    const age = (clock.elapsedTime - born.current) / 0.55
    if (age >= 1) {
      mesh.visible = false
      return
    }
    mesh.visible = true
    mesh.scale.setScalar(1 + age * 2.6)
    const material = mesh.material as { opacity: number }
    material.opacity = 0.7 * (1 - age)
  })

  return (
    <group position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.22, 0.3, 24]} />
        <meshBasicMaterial color="#35e0f0" transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <mesh ref={pulse}>
        <ringGeometry args={[0.3, 0.36, 24]} />
        <meshBasicMaterial color="#35e0f0" transparent opacity={0.7} depthWrite={false} />
      </mesh>
    </group>
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
