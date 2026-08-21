import { useOccupants, useRoomStore } from '../state/useRoomStore'
import { RENDER_DELAY_MS, ROOM_CAPACITY, TICK_HZ } from '../net/protocol'

export function Hud() {
  const me = useRoomStore((s) => s.me)
  const status = useRoomStore((s) => s.status)
  const stats = useRoomStore((s) => s.stats)
  const smoothing = useRoomStore((s) => s.smoothing)
  const toggleSmoothing = useRoomStore((s) => s.toggleSmoothing)
  const occupants = useOccupants()

  return (
    <div className="pointer-events-auto w-64 rounded-lg border border-white/10 bg-black/55 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span
          className={`size-2 rounded-full ${status === 'ready' ? 'bg-emerald-400' : status === 'full' ? 'bg-amber-400' : status === 'error' ? 'bg-rose-500' : 'bg-slate-500'}`}
        />
        <h1 className="text-xs font-medium tracking-wide text-slate-200 uppercase">
          In the room
        </h1>
        <span className="ml-auto text-xs text-slate-400">
          {occupants.length}/{ROOM_CAPACITY}
        </span>
      </div>

      <ul className="mt-2 space-y-1 text-xs">
        {occupants.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.colour }} />
            <span className="truncate text-slate-200">{p.name}</span>
            {p.id === me?.id ? <span className="ml-auto text-slate-500">you</span> : null}
          </li>
        ))}
        {occupants.length === 0 ? <li className="text-slate-500">Just you, so far.</li> : null}
      </ul>

      <hr className="my-3 border-white/10" />

      <button
        type="button"
        onClick={toggleSmoothing}
        aria-pressed={smoothing}
        className="flex w-full items-center justify-between rounded border border-white/15 px-2 py-1.5 text-xs text-slate-200 hover:bg-white/5"
      >
        <span>Interpolation</span>
        <span className={smoothing ? 'text-emerald-300' : 'text-rose-300'}>
          {smoothing ? 'on' : 'off'}
        </span>
      </button>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
        {smoothing
          ? `Everyone else is drawn ${RENDER_DELAY_MS} ms in the past, between the two packets either side of that moment.`
          : `Raw packets, no smoothing. This is what ${TICK_HZ} updates a second actually looks like.`}
      </p>

      <hr className="my-3 border-white/10" />

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-400">
        <Stat label="fps" value={stats.fps} />
        <Stat label="tick" value={`${TICK_HZ} Hz`} />
        <Stat label="out/s" value={stats.out} />
        <Stat label="in/s" value={stats.in} />
        <Stat label="delay" value={`${RENDER_DELAY_MS} ms`} />
      </dl>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className={tone ?? 'text-slate-200'}>{value}</dd>
    </div>
  )
}
