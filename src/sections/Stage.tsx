import { useEffect, useRef, useState } from 'react'
import { Room } from '../scene/Room'
import { Hud } from '../ui/Hud'
import { Guestbook } from '../ui/Guestbook'
import { Overlay } from '../ui/Overlay'
import { ArrowIcon, SiteHeader } from '../chrome'
import { useRoomStore } from '../state/useRoomStore'
import { RENDER_DELAY_MS, TICK_HZ } from '../net/protocol'
import { BRAND, NAV, REPO_URL } from '../site'

/**
 * The room, at the top of the page, with the page scrolling past it.
 *
 * There is no landing page in front of the canvas on purpose. The URL dropping
 * you straight into the thing is this project's best quality, and putting a
 * hero slide in the way to explain the room would be explaining it to somebody
 * who could simply be standing in it.
 *
 * The stage is a grid rather than a stack of floating panels: header, canvas,
 * title band, each divided by one hairline. Only the two instrument panels sit
 * over the canvas, because they are readouts of the scene rather than page
 * furniture, and they are opaque with a hairline border rather than blurred
 * glass.
 */
export function Stage() {
  const ref = useRef<HTMLElement>(null)
  const [running, setRunning] = useState(true)

  // A WebGL scene that keeps rendering while you read section six is spending
  // your battery to draw something nobody is looking at, which on a page about
  // frame budget would be an odd thing to ship.
  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setRunning(Boolean(entry?.isIntersecting)), {
      threshold: 0,
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="stage" ref={ref} aria-labelledby="stage-title">
      <div className="stage-shell">
        <SiteHeader name={BRAND} nav={NAV} sourceUrl={REPO_URL} />
      </div>

      <div className="stage-canvas">
        <Room frameloop={running ? 'always' : 'never'} />

        <div className="stage-panels">
          <Hud />
          <Guestbook />
        </div>

        <Overlay />
      </div>

      <div className="stage-shell">
        <Hero />
      </div>
    </section>
  )
}

/**
 * The one voice moment.
 *
 * Anybody carries a width axis as well as a weight axis, and the delay figure
 * is set at whatever width the measured gap between two packets currently
 * works out to: narrow when updates are landing close together, wide when they
 * are not. The number itself is a constant, so the type is the only part of it
 * that is live. Nothing else on the page uses the axis.
 */
function Hero() {
  const gapMs = useRoomStore((s) => s.stats.gapMs)

  // 60 ms of gap is as tight as this transport gets and 200 ms is where a
  // 10 Hz stream has visibly fallen behind, so those are the ends of the axis.
  const width = gapMs === 0 ? 100 : Math.max(75, Math.min(150, 75 + ((gapMs - 60) / 140) * 75))

  return (
    <div className="hero">
      <p className="eyebrow">
        <span>live</span> a shared 3D room, and the measurements behind it
      </p>

      <h1 id="stage-title">
        Eight people, ten packets a second. Everyone else is drawn{' '}
        <em className="voice" style={{ fontStretch: `${Math.round(width)}%` }}>
          120&nbsp;ms
        </em>{' '}
        in the past.
      </h1>

      <div className="hero-foot">
        <p className="hero-note">
          Move with WASD or the arrow keys, tap the floor on a phone, drag to look around. Open this
          page in a second window and the two of you are in the same room.
        </p>

        <p className="hero-readout" role="status">
          {gapMs === 0
            ? `Nobody else is moving yet, so there is nothing to measure. The room sends ${TICK_HZ} updates a second and draws everyone else ${RENDER_DELAY_MS} ms late.`
            : `Packets from one sender are landing ${gapMs} ms apart. The width of the figure above is set from that.`}
        </p>

        <a className="scroll-cue" href="#pipeline">
          Why 120 ms <ArrowIcon />
        </a>
      </div>
    </div>
  )
}
