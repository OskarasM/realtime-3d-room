import { useEffect, useRef, useState } from 'react'
import { Band } from '../ui/Band'
import probe from '../data/rate-probe.json'
import { SOURCE } from '../site'

/**
 * What presence does when you go past its call allowance.
 *
 * This is the measurement that decided the architecture, and the summary form
 * of it ("five of twelve succeeded") loses the half that matters: the seven
 * failures do not fail fast, they hang for ten seconds each. Drawn to scale,
 * that is a minute and a quarter of a bar chart in which almost nothing
 * happens, which is the correct impression.
 *
 * The data is a recording, in src/data/rate-probe.json, produced by
 * npm run record against a real project. Nothing here calls Supabase.
 */

const SPEED = 10 // replay rate, so seventy five seconds of it takes seven and a half

export function Presence() {
  const [elapsed, setElapsed] = useState<number | null>(null)
  const raf = useRef(0)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const play = () => {
    cancelAnimationFrame(raf.current)
    const started = performance.now()
    const step = () => {
      const at = (performance.now() - started) * SPEED
      if (at >= probe.totalMs) {
        setElapsed(probe.totalMs)
        return
      }
      setElapsed(at)
      raf.current = requestAnimationFrame(step)
    }
    setElapsed(0)
    raf.current = requestAnimationFrame(step)
  }

  const showAll = elapsed === null
  const clock = showAll ? probe.totalMs : elapsed
  const reached = (call: (typeof probe.calls)[number]) => showAll || clock >= call.startedMs

  return (
    <Band
      id="presence"
      mark={`${probe.ok} / 30 s`}
      title="Presence cannot carry position"
      lede={
        <>
          Supabase Realtime allows five presence calls per client per thirty seconds. That is one
          update every six seconds, which is not a position, so position had to go somewhere else.
          Here is what the sixth call actually does.
        </>
      }
    >
      <div className="controls">
        <button className="button is-primary" type="button" onClick={play}>
          Replay the probe
        </button>
        <p className="controls-note" role="status">
          {showAll
            ? `Recorded ${probe.recordedAt}. ${probe.attempts} track() calls, 400 ms apart, one client.`
            : `t+${(clock / 1000).toFixed(1)} s of ${(probe.totalMs / 1000).toFixed(0)} s, replayed at ${SPEED}x.`}
        </p>
      </div>

      <div className="probe" role="table" aria-label="Twelve presence calls, drawn to scale">
        <div className="probe-head" role="row">
          <span role="columnheader">call</span>
          <span role="columnheader">result</span>
          <span role="columnheader">time taken, to scale</span>
          <span role="columnheader">ms</span>
        </div>

        {probe.calls.map((call) => {
          const failed = call.result !== 'ok'
          return (
            <div
              className={`probe-row${reached(call) ? '' : ' is-pending'}${failed ? ' is-failed' : ''}`}
              role="row"
              key={call.call}
            >
              <span className="probe-index" role="cell">
                {String(call.call).padStart(2, '0')}
              </span>
              <span className="probe-result" role="cell">
                {reached(call) ? call.result : 'waiting'}
              </span>
              <span className="probe-track" role="cell">
                <span
                  className="probe-bar"
                  style={{
                    // Every bar is drawn against the same seventy five seconds,
                    // so the five that succeeded are correctly almost invisible.
                    width: `${(call.durationMs / probe.totalMs) * 100}%`,
                    marginLeft: `${(call.startedMs / probe.totalMs) * 100}%`,
                    visibility: reached(call) ? 'visible' : 'hidden',
                  }}
                />
              </span>
              <span className="probe-ms" role="cell">
                {reached(call) ? call.durationMs.toLocaleString('en-GB') : '--'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="findings">
        <Finding value={`${probe.ok} of ${probe.attempts}`} label="acknowledged" />
        <Finding value={`call ${probe.firstFailureAt}`} label="first failure" warn />
        <Finding value={`${(probe.totalMs / 1000).toFixed(0)} s`} label="to make 12 calls" warn />
        <Finding value="10 s" label="per rejected call" warn />
      </div>

      <div className="prose">
        <p>
          Twelve calls spaced 400 ms apart should take under five seconds. They took seventy five. A
          rejected <code>track()</code> does not return an error, it sits there until the client side
          timeout, so an implementation that put position on presence would not merely drop updates.
          It would block for ten seconds at a time while dropping them.
        </p>
        <p>
          The allowance matched the documentation exactly: five succeeded, the sixth did not. That is
          the rare case where the published limit and the measured one agree, and it is worth saying
          so, because the send rate ceiling in the same spike did not behave that way at all.
        </p>
      </div>

      <p className="source-line">
        Recording: <a href={SOURCE('src/data/rate-probe.json')}>src/data/rate-probe.json</a>. Produced
        by <a href={SOURCE('spike/record-trace.ts')}>spike/record-trace.ts</a>, which you can run
        against your own project with <code>npm run record</code>.
      </p>
    </Band>
  )
}

function Finding({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  return (
    <div className={`finding${warn ? ' is-warn' : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
