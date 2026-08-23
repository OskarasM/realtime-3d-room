import { useImperativeHandle, useRef, type Ref } from 'react'
import type { Sample } from '../net/interpolation'
import { ROOM_HALF } from '../net/protocol'

export type PaneHandle = {
  draw: (sample: Sample | null) => void
  clear: () => void
}

/** How many past positions the trail keeps. At 60 Hz this is about a second
 *  and a half of history, which is long enough to show a corner being turned
 *  and short enough that the square does not simply close into a box. */
const TRAIL = 90

/**
 * A top-down view of one player, drawn imperatively.
 *
 * Nothing in here goes through React state. The parent runs one animation frame
 * loop and writes straight to these DOM nodes, which is the same reason the
 * live room keeps positions in a plain module-level map: sixty state updates a
 * second to move a dot would spend the frame budget on reconciliation.
 *
 * SVG rather than a WebGL canvas on purpose. The argument here is about where a
 * position is drawn, not about rendering, and two small vector panes make that
 * comparison at a glance on a phone with no second GPU context to lose.
 */
export function Pane({
  ref,
  label,
  note,
  tone,
  description,
}: {
  ref?: Ref<PaneHandle>
  label: string
  note: string
  tone: 'warn' | 'accent'
  description: string
}) {
  const marker = useRef<SVGGElement>(null)
  const trail = useRef<SVGPolylineElement>(null)
  const points = useRef<{ x: number; z: number }[]>([])

  useImperativeHandle(ref, () => ({
    draw(sample) {
      const group = marker.current
      if (!group) return
      if (!sample) {
        group.style.visibility = 'hidden'
        return
      }
      group.style.visibility = 'visible'
      // Rotation is in degrees and about the vertical axis in the scene, so it
      // becomes a rotation in the plane here. Negated because SVG's y axis runs
      // down the screen and the room's z axis runs away from the camera.
      group.setAttribute(
        'transform',
        `translate(${sample.x.toFixed(3)} ${sample.z.toFixed(3)}) rotate(${(-sample.ry * (180 / Math.PI)).toFixed(1)})`,
      )

      const trailPoints = points.current
      trailPoints.push({ x: sample.x, z: sample.z })
      if (trailPoints.length > TRAIL) trailPoints.shift()
      trail.current?.setAttribute(
        'points',
        trailPoints.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).join(' '),
      )
    },
    clear() {
      points.current = []
      trail.current?.setAttribute('points', '')
    },
  }))

  const grid: number[] = []
  for (let i = -ROOM_HALF + 2; i < ROOM_HALF; i += 2) grid.push(i)

  return (
    <figure className={`pane is-${tone}`}>
      <figcaption>
        <span className="pane-label">{label}</span>
        <code className="pane-note">{note}</code>
      </figcaption>

      <svg viewBox={`${-ROOM_HALF} ${-ROOM_HALF} ${ROOM_HALF * 2} ${ROOM_HALF * 2}`} role="img">
        <title>{label}</title>
        <desc>{description}</desc>

        <g className="pane-grid" aria-hidden="true">
          {grid.map((at) => (
            <line key={`h${at}`} x1={-ROOM_HALF} y1={at} x2={ROOM_HALF} y2={at} />
          ))}
          {grid.map((at) => (
            <line key={`v${at}`} x1={at} y1={-ROOM_HALF} x2={at} y2={ROOM_HALF} />
          ))}
        </g>

        <polyline ref={trail} className="pane-trail" points="" />

        <g ref={marker} className="pane-marker" style={{ visibility: 'hidden' }}>
          <circle r="0.4" />
          {/* A notch inside the dot rather than an arrow outside it: the point
              of this pane is where the dot is, and a spike on the front of it
              reads as part of the position. */}
          <path d="M -0.15 0.05 L 0 0.33 L 0.15 0.05 Z" className="pane-heading" />
        </g>
      </svg>
    </figure>
  )
}
