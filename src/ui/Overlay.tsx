import { useRoomStore } from '../state/useRoomStore'
import { ROOM_CAPACITY } from '../net/protocol'

/**
 * Everything that can go wrong, said in English.
 *
 * A stranger opening the deployed URL should never see a blank canvas and have
 * to open the console to find out why, and somebody who has just cloned this
 * should be told exactly which setting they have not turned on yet.
 */
export function Overlay() {
  const status = useRoomStore((s) => s.status)
  const error = useRoomStore((s) => s.error)

  if (status === 'ready') return null

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="max-w-md rounded-xl border border-white/10 bg-slate-950/90 p-6 text-center">
        {status === 'error' ? (
          <>
            <h2 className="text-lg font-medium text-rose-300">The room would not open</h2>
            <p className="mt-2 text-sm break-words text-slate-300">{error}</p>
          </>
        ) : status === 'full' ? (
          <>
            <h2 className="text-lg font-medium text-amber-300">The room is full</h2>
            <p className="mt-2 text-sm text-slate-300">
              {ROOM_CAPACITY} people is the cap, and it is not arbitrary: the Supabase free
              plan allows 100 messages a second across the whole project, and everyone in
              here sends 10 a second. You will be let in as soon as somebody leaves.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-medium text-slate-200">Opening the room</h2>
            <p className="mt-2 text-sm text-slate-400">
              Signing you in anonymously and joining the channel.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
