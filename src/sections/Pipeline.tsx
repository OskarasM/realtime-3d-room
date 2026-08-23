import { Band } from '../ui/Band'
import { RENDER_DELAY_MS, SEND_INTERVAL_MS, TICK_HZ } from '../net/protocol'
import { SOURCE } from '../site'

/**
 * The whole architecture, as a chain you can read left to right.
 *
 * Every stage names the file it happens in, because a diagram that cannot be
 * checked against the code is decoration.
 */
const STAGES = [
  {
    at: 't+0',
    title: 'You press a key',
    body: 'Held keys go into a ref, never into state. A keypress that re-rendered the tree would re-render it for something only the render loop reads.',
    file: 'src/scene/useKeyboard.ts',
  },
  {
    at: 'every frame',
    title: 'You move, immediately',
    body: 'Your own avatar is driven straight from the keys at 60 Hz and is never interpolated. Routing your own movement through the network would feel like playing over a delay.',
    file: 'src/scene/LocalPlayer.tsx',
  },
  {
    at: `every ${SEND_INTERVAL_MS} ms`,
    title: 'Your position is broadcast',
    body: `Ten times a second, two decimal places, fire and forget. Standing still costs one keepalive every two seconds and nothing else.`,
    file: 'src/net/useRoom.ts',
  },
  {
    at: 'on arrival',
    title: 'It lands in their buffer',
    body: "Checked, clamped, and stamped with the receiver's own clock. No clocks are synchronised between browsers: we only replay what arrived, at the rate it arrived.",
    file: 'src/net/interpolation.ts',
  },
  {
    at: `t+${RENDER_DELAY_MS} ms`,
    title: 'You are drawn, slightly late',
    body: 'They draw you where you were 120 ms ago, between the two packets either side of that moment, which is a position they hold both ends of rather than a guess.',
    file: 'src/net/interpolation.ts',
  },
] as const

export function Pipeline() {
  return (
    <Band
      id="pipeline"
      mark="t+0"
      title="What is actually happening"
      lede={
        <>
          Two things travel, and they travel separately. Who is here goes on presence, which is rare
          and reliable and cleans up after a disconnect. Where they are goes on broadcast, {TICK_HZ}{' '}
          times a second, and nobody waits for an acknowledgement.
        </>
      }
    >
      <div className="prose">
        <p>
          A position from 200 ms ago is worth less than no position at all, so there is nothing
          useful to do about a broadcast that fails except send the next, newer one. That single
          decision is why none of the hard netcode is in this project: there is no retry queue, no
          reliability layer and no acknowledgement to wait on.
        </p>
        <p>
          The asymmetry is the other half. You are live and everyone else is a replay, which is what
          lets eight browsers agree on a room with no authoritative server between them. The worst
          thing you can lie about is where your own capsule stands.
        </p>
      </div>

      <ol className="chain">
        {STAGES.map((stage) => (
          <li key={stage.title}>
            <span className="chain-at">{stage.at}</span>
            <h3>{stage.title}</h3>
            <p>{stage.body}</p>
            <a className="chain-file" href={SOURCE(stage.file)}>
              {stage.file}
            </a>
          </li>
        ))}
      </ol>
    </Band>
  )
}
