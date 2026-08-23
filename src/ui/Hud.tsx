import { useOccupants, useRoomStore } from '../state/useRoomStore'
import { RENDER_DELAY_MS, ROOM_CAPACITY, TICK_HZ } from '../net/protocol'

/**
 * The instrument panel over the scene.
 *
 * Opaque, hairline bordered, square cornered. Not a glass panel: blurring the
 * thing you are reading numbers off costs a compositing pass to make them
 * harder to read, and a translucent readout over a moving 3D scene has no
 * stable contrast ratio at all.
 *
 * Every row has a fixed height, because these figures update once a second and
 * a panel that resizes when a number gains a digit reads as a web page rather
 * than an instrument.
 */
export function Hud() {
  const me = useRoomStore((s) => s.me)
  const status = useRoomStore((s) => s.status)
  const stats = useRoomStore((s) => s.stats)
  const smoothing = useRoomStore((s) => s.smoothing)
  const toggleSmoothing = useRoomStore((s) => s.toggleSmoothing)
  const occupants = useOccupants()

  return (
    <section className="panel hud" aria-label="Room readout">
      <header className="panel-head">
        <span className={`status-dot is-${status}`} aria-hidden="true" />
        <h2>In the room</h2>
        <span className="panel-count">
          {occupants.length}/{ROOM_CAPACITY}
        </span>
      </header>

      <ul className="roster">
        {occupants.map((p) => (
          <li key={p.id}>
            <span className="swatch" style={{ backgroundColor: p.colour }} aria-hidden="true" />
            <span className="roster-name">{p.name}</span>
            {p.id === me?.id ? <span className="roster-you">you</span> : null}
          </li>
        ))}
        {occupants.length === 0 ? <li className="roster-empty">Just you, so far.</li> : null}
      </ul>

      <div className="panel-block">
        <button className="toggle" type="button" onClick={toggleSmoothing} aria-pressed={smoothing}>
          <span>Interpolation</span>
          <span className={smoothing ? 'toggle-on' : 'toggle-off'}>{smoothing ? 'on' : 'off'}</span>
        </button>
        <p className="panel-note">
          {smoothing
            ? `Everyone else is drawn ${RENDER_DELAY_MS} ms in the past, between the two packets either side of that moment.`
            : `Raw packets, no smoothing. This is what ${TICK_HZ} updates a second actually looks like.`}
        </p>
      </div>

      <dl className="readout">
        <Stat label="fps" value={stats.fps} />
        <Stat label="tick" value={`${TICK_HZ} Hz`} />
        <Stat label="out/s" value={stats.out} />
        <Stat label="in/s" value={stats.in} />
        <Stat label="gap" value={stats.gapMs === 0 ? '--' : `${stats.gapMs} ms`} />
        <Stat label="delay" value={`${RENDER_DELAY_MS} ms`} />
        {/* Only shown once it has happened. A permanent zero invites the reader
            to wonder what is wrong with it; a number appearing means something
            on the channel is sending packets this client will not accept. */}
        {stats.bad > 0 ? <Stat label="refused" value={stats.bad} warn /> : null}
      </dl>
    </section>
  )
}

function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="readout-row">
      <dt>{label}</dt>
      <dd className={warn ? 'is-warn' : undefined}>{value}</dd>
    </div>
  )
}
