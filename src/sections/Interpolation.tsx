import { useCallback, useEffect, useRef, useState } from 'react'
import { Band } from '../ui/Band'
import { Pane, type PaneHandle } from '../ui/Pane'
import { Replay } from '../net/replay'
import { packetTrace } from '../net/replay'
import { RENDER_DELAY_MS, TICK_HZ } from '../net/protocol'
import { SOURCE, SPIKE } from '../site'

/**
 * The comparison the whole project exists to make.
 *
 * Both panes read one SnapshotBuffer, filled from one recording. The left calls
 * sampleRaw(), which jumps to the newest packet. The right calls sample(), which
 * draws the position RENDER_DELAY_MS in the past, between the two packets either
 * side of that moment. Same data, same buffer, one method apart.
 *
 * It is the app's own src/net/interpolation.ts doing the work, not a
 * reimplementation of it for the page. A demo that reimplements the thing it is
 * demonstrating is only ever demonstrating the demo.
 */
export function Interpolation() {
  const rawPane = useRef<PaneHandle>(null)
  const smoothPane = useRef<PaneHandle>(null)
  const replay = useRef(new Replay())
  const frame = useRef(0)

  const [extraDelayMs, setExtraDelayMs] = useState(0)
  const [lossPct, setLossPct] = useState(0)
  const [running, setRunning] = useState(true)
  const [stats, setStats] = useState({ offered: 0, delivered: 0, p50: 0, p95: 0 })

  // Read from refs inside the loop rather than from the closure, so changing a
  // slider does not have to tear down and restart the animation frame.
  const options = useRef({ extraDelayMs, lossPct })
  options.current = { extraDelayMs, lossPct }

  useEffect(() => {
    // Motion is the content here, so it is not simply disabled under a reduced
    // motion preference: it becomes a play button, and the numbers underneath
    // are readable either way.
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) setRunning(false)
  }, [])

  useEffect(() => {
    if (!running) return

    let lastPublish = 0
    const loop = (now: number) => {
      replay.current.pump(now, options.current)
      rawPane.current?.draw(replay.current.buffer.sampleRaw())
      smoothPane.current?.draw(replay.current.buffer.sample(now))

      // The panes are written to every frame; React hears about the numbers
      // four times a second, which is as often as a p95 is worth reading.
      if (now - lastPublish > 250) {
        lastPublish = now
        setStats(replay.current.stats())
      }

      frame.current = requestAnimationFrame(loop)
    }

    frame.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame.current)
  }, [running])

  const restart = useCallback(() => {
    replay.current = new Replay()
    rawPane.current?.clear()
    smoothPane.current?.clear()
    setStats({ offered: 0, delivered: 0, p50: 0, p95: 0 })
  }, [])

  const deliveredPct =
    stats.offered === 0 ? 100 : Math.round((stats.delivered / stats.offered) * 1000) / 10

  return (
    <Band
      id="interpolation"
      mark={`t+${RENDER_DELAY_MS}ms`}
      title="Drawing a packet when it arrives looks like teleporting"
      lede={
        <>
          At {TICK_HZ} updates a second, a position lands every 100 ms. Setting the avatar there the
          instant it arrives is a teleport ten times a second. Drag the two sliders and watch which
          pane stops being watchable.
        </>
      }
    >
      <div className="lab">
        <div className="panes">
          <Pane
            ref={rawPane}
            label="Drawn on arrival"
            note="buffer.sampleRaw()"
            tone="warn"
            description="A top-down view of one player walking a square circuit, moved to each position the moment its packet lands."
          />
          <Pane
            ref={smoothPane}
            label={`Drawn ${RENDER_DELAY_MS} ms late`}
            note="buffer.sample(now)"
            tone="accent"
            description="The same player from the same packets, drawn between the two positions either side of the moment 120 ms ago."
          />
        </div>

        <div className="controls">
          <Slider
            id="delay"
            label="Extra delay"
            value={extraDelayMs}
            min={0}
            max={300}
            step={10}
            unit="ms"
            onChange={setExtraDelayMs}
          />
          <Slider
            id="loss"
            label="Packet loss"
            value={lossPct}
            min={0}
            max={30}
            step={1}
            unit="%"
            onChange={setLossPct}
          />
          <div className="controls-buttons">
            <button className="button" type="button" onClick={() => setRunning((r) => !r)}>
              {running ? 'Pause' : 'Play'}
            </button>
            <button className="button" type="button" onClick={restart}>
              Restart
            </button>
          </div>
        </div>
      </div>

      <div className="table-scroll" tabIndex={0} role="region" aria-label="Arrival statistics, scrollable">
        <table className="data-table">
        <caption className="sr-only">
          Live arrival statistics for the replayed packet stream, against the figures measured by the
          spike
        </caption>
        <thead>
          <tr>
            <th scope="col">Measurement</th>
            <th scope="col">This replay, now</th>
            <th scope="col">Measured, 2 clients</th>
            <th scope="col">Measured, {SPIKE.clients} clients</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Inter-arrival p50</th>
            <td className="num">{stats.p50} ms</td>
            <td className="num">{packetTrace.interArrivalMs.p50} ms</td>
            <td className="num">{SPIKE.p50} ms</td>
          </tr>
          <tr>
            <th scope="row">Inter-arrival p95</th>
            <td className="num">{stats.p95} ms</td>
            <td className="num">{packetTrace.interArrivalMs.p95} ms</td>
            <td className="num">{SPIKE.p95} ms</td>
          </tr>
          <tr>
            <th scope="row">Delivered</th>
            <td className="num">{deliveredPct}%</td>
            <td className="num">{packetTrace.deliveredPct}%</td>
            <td className="num">{SPIKE.deliveredPct}%</td>
          </tr>
          </tbody>
        </table>
      </div>

      <div className="prose">
        <p>
          The 120 ms was chosen before any of this was measured: one full packet interval at 10 Hz,
          plus 20 ms of slack for jitter. The recording then put the 95th percentile gap at{' '}
          {packetTrace.interArrivalMs.p95} ms between two clients and the spike put it at{' '}
          {SPIKE.p95} ms across a full room, so the delay sits almost exactly on the measurement it
          needs to cover. That is luck as much as judgement, and the useful part is that it can now
          be checked rather than asserted.
        </p>
        <p>
          The recording itself lost nothing at all: {packetTrace.received} of {packetTrace.sent}{' '}
          packets arrived between two clients on an idle channel. Loss only appeared under the
          aggregate load of {SPIKE.clients} clients, where {SPIKE.lossPct} per cent went missing
          while the project was still under its documented ceiling. That is why the loss slider is a
          slider rather than part of the recording: it is a condition you have to reach, not one
          that is always there.
        </p>
        <p>
          Turn the loss up and the smoothed pane degrades gracefully, because a dropped packet just
          becomes a longer interpolation between the two either side of it. It stops holding at the
          point where the gap is wider than the buffer can straddle, and then it freezes rather than
          extrapolating, which is a decision you can read in{' '}
          <a href={SOURCE('src/net/interpolation.ts')}>interpolation.ts</a>: guessing forward can
          overshoot, and an avatar that overshoots has to snap back.
        </p>
      </div>

      <p className="source-line">
        Recording: <a href={SOURCE('src/data/packet-trace.json')}>src/data/packet-trace.json</a>,{' '}
        {packetTrace.recordedAt}. Replay:{' '}
        <a href={SOURCE('src/net/replay.ts')}>src/net/replay.ts</a>. Buffer:{' '}
        <a href={SOURCE('src/net/interpolation.ts')}>src/net/interpolation.ts</a>, the same file the
        live room above runs on.
      </p>
    </Band>
  )
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
}) {
  return (
    <div className="slider">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output htmlFor={id}>
        {value}
        {unit}
      </output>
    </div>
  )
}
