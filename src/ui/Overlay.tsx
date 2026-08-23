import { useRoomStore } from '../state/useRoomStore'
import { ROOM_CAPACITY } from '../net/protocol'

/**
 * Everything that can go wrong, said in English.
 *
 * A stranger opening the deployed URL should never see a blank canvas and have
 * to open the console to find out why, and somebody who has just cloned this
 * should be told exactly which setting they have not turned on yet.
 *
 * It covers the canvas and nothing else. The rest of the page keeps working
 * with no connection at all, which is the point: every measured claim below is
 * a recording, so the argument survives a paused free project.
 */
export function Overlay() {
  const status = useRoomStore((s) => s.status)
  const error = useRoomStore((s) => s.error)

  if (status === 'ready') return null

  return (
    <div className="stage-overlay" role="status">
      <div className="overlay-card">
        {status === 'error' ? (
          <>
            <h2 className="is-warn">The room would not open</h2>
            <p>{error}</p>
            <p className="overlay-note">
              Everything below this canvas still works. The measurements further down the page are
              recordings, not live calls.
            </p>
          </>
        ) : status === 'full' ? (
          <>
            <h2>The room is full</h2>
            <p>
              {ROOM_CAPACITY} people is the cap, and it is not arbitrary: the Supabase free plan
              allows 100 messages a second across the whole project, and everyone in here sends 10 a
              second. You will be let in as soon as somebody leaves.
            </p>
          </>
        ) : (
          <>
            <h2>Opening the room</h2>
            <p>Signing you in anonymously and joining the channel.</p>
          </>
        )}
      </div>
    </div>
  )
}
