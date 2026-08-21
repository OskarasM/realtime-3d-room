/**
 * One visitor. A capsule, a wedge showing which way they face, and a dark disc
 * standing in for a shadow.
 *
 * The disc is deliberately not a real shadow. Shadow maps mean an extra depth
 * pass every frame, which is the first thing to cost you frames on a mid-range
 * phone, and at this scale nobody can tell. Eight flat circles cost nothing.
 */
export function Avatar({ colour, dim = false }: { colour: string; dim?: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.62, 0]}>
        <capsuleGeometry args={[0.34, 0.52, 4, 14]} />
        <meshStandardMaterial
          color={colour}
          roughness={0.42}
          metalness={0.05}
          transparent={dim}
          opacity={dim ? 0.45 : 1}
        />
      </mesh>

      {/* Forward is +Z when rotation.y is zero. */}
      <mesh position={[0, 0.62, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.15, 0.32, 10]} />
        <meshStandardMaterial color="#0a0e13" roughness={0.6} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.46, 22]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  )
}
