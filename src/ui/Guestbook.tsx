import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRoomStore } from '../state/useRoomStore'

export type Entry = {
  user_id: string
  name: string
  colour: string
  signed_at: string
}

/**
 * The one thing here that outlives the session.
 *
 * Everything else is presence and broadcast, which exist only while the socket
 * does. This is a Postgres table, and the only thing between it and a stranger
 * holding the publishable key is a Row Level Security policy. Walking in signs
 * it; the policy section further down the page attacks it.
 */
export function Guestbook() {
  const me = useRoomStore((s) => s.me)
  const status = useRoomStore((s) => s.status)
  const [entries, setEntries] = useState<Entry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('guestbook')
      .select('user_id, name, colour, signed_at')
      .order('signed_at', { ascending: false })
      .limit(30)
    if (error) setError(error.message)
    else setEntries(data ?? [])
  }, [])

  useEffect(() => {
    if (!me || status === 'booting' || status === 'error') return

    void (async () => {
      // ignoreDuplicates because signing twice is not an error, it is the
      // primary key on user_id doing its job. A plain insert works too and
      // comes back 409, but that is a red line in everybody's console for
      // something that behaved exactly as intended.
      const { error } = await supabase.from('guestbook').upsert(
        { user_id: me.id, name: me.name, colour: me.colour },
        { onConflict: 'user_id', ignoreDuplicates: true },
      )
      if (error) setError(error.message)
      await load()
    })()
  }, [me, status, load])

  return (
    <section className="panel guestbook" aria-label="Guestbook">
      <h2 className="sr-only">Guestbook</h2>
      <button
        className="panel-head panel-toggle"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="guestbook-body"
      >
        <span>Guestbook</span>
        <span className="panel-count">
          {entries.length} {open ? '-' : '+'}
        </span>
      </button>

      {open ? (
        <div className="panel-block" id="guestbook-body">
          {error ? <p className="panel-error">{error}</p> : null}

          <ul className="roster is-scrolling" tabIndex={0} role="region" aria-label="Recent signatures, scrollable">
            {entries.map((e) => (
              <li key={e.user_id}>
                <span className="swatch" style={{ backgroundColor: e.colour }} aria-hidden="true" />
                <span className="roster-name">{e.name}</span>
                <span className="roster-when">{ago(e.signed_at)}</span>
              </li>
            ))}
            {entries.length === 0 ? <li className="roster-empty">Nobody has signed yet.</li> : null}
          </ul>

          <p className="panel-note">
            Signed for you when you walked in. Nobody can edit or remove a row, including their own.{' '}
            <a href="#policy">See why</a>.
          </p>
        </div>
      ) : null}
    </section>
  )
}

export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}
