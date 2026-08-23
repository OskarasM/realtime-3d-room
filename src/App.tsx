import { useRoom } from './net/useRoom'
import { SiteFooter } from './chrome'
import { Strip } from './ui/Band'
import { Stage } from './sections/Stage'
import { Pipeline } from './sections/Pipeline'
import { Presence } from './sections/Presence'
import { Interpolation } from './sections/Interpolation'
import { Policy } from './sections/Policy'
import { Run } from './sections/Run'
import { Limits } from './sections/Limits'
import { CtaBand } from './ui/Cta'
import { BRAND, SIBLING_SITES } from './site'

/**
 * The page, in the order somebody meets it.
 *
 * The room is first and the explanation follows, rather than the other way
 * round. Everything after the canvas works with no connection at all: the two
 * sections that make measured claims replay committed recordings, so an
 * employer opening this when the room is empty, or when the free project has
 * been paused, still sees the entire argument.
 */
export default function App() {
  useRoom()

  return (
    <>
      <Stage />

      <main id="main">
        <Pipeline />
        <Strip>Presence says who. Broadcast says where.</Strip>
        <Presence />
        <Interpolation />
        <Policy />
        <Run />
        <Limits />
        <CtaBand />
      </main>

      <SiteFooter
        name={BRAND}
        blurb="A shared 3D room, and the measurements that decided its shape."
        links={SIBLING_SITES}
      />
    </>
  )
}
