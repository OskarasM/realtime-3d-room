import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRoomStore } from '../state/useRoomStore'

type Entry = {
  user_id: string
  name: string
  colour: string
  signed_at: string
}

/**
 * The one thing in this project that outlives the session.
 *
 * Everything else is presence and broadcast, which exist only while you are
 * connected. The guestbook is a Postgres table, and the only thing standing
 * between it and a stranger with your publishable key is a Row Level Security
 * policy. The "prove it" button below attacks that policy from the browser so
 * you can watch it hold.
 */
export function Guestbook() {
  const me = useRoomStore((s) => s.me)
  const status = useRoomStore((s) => s.status)
  const [entries, setEntries] = useState<Entry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [proof, setProof] = useState<string | null>(null)
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
      const { error } = await supabase.from('guestbook').insert({
        user_id: me.id,
        name: me.name,
        colour: me.colour,
      })
      // 23505 is a duplicate key, which here means "you have signed before".
      // That is the primary key doing the work, not a client-side check, so a
      // second tab or a refresh cannot produce a second entry.
      if (error && error.code !== '23505') setError(error.message)
      await load()
    })()
  }, [me, status, load])

  const proveRls = useCallback(async () => {
    // Deliberately sign as somebody who is not us. The publishable key is happy
    // to send this. Postgres is not.
    const { error } = await supabase.from('guestbook').insert({
      user_id: crypto.randomUUID(),
      name: 'not me',
      colour: '#ff0000',
    })
    setProof(
      error
        ? `Rejected: ${error.code ?? 'error'} ${error.message}`
        : 'It went through, which means the insert policy is missing. Re-run the migration.',
    )
  }, [])

  return (
    <div className="pointer-events-auto w-64 rounded-lg border border-white/10 bg-black/55 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium tracking-wide text-slate-200 uppercase"
      >
        <span>Guestbook</span>
        <span className="text-slate-400">
          {entries.length} {open ? '−' : '+'}
        </span>
      </button>

      {open ? (
        <div className="border-t border-white/10 px-3 py-2">
          {error ? <p className="mb-2 text-xs text-rose-300">{error}</p> : null}

          <ul className="max-h-48 space-y-1 overflow-y-auto pr-1 text-xs">
            {entries.map((e) => (
              <li key={e.user_id} className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: e.colour }}
                />
                <span className="truncate text-slate-200">{e.name}</span>
                <span className="ml-auto shrink-0 text-slate-500">{ago(e.signed_at)}</span>
              </li>
            ))}
            {entries.length === 0 ? (
              <li className="text-slate-500">Nobody has signed yet.</li>
            ) : null}
          </ul>

          <button
            type="button"
            onClick={proveRls}
            className="mt-3 w-full rounded border border-white/15 px-2 py-1 text-xs text-slate-300 hover:bg-white/5"
          >
            Try signing as someone else
          </button>
          {proof ? <p className="mt-2 text-xs break-words text-amber-300">{proof}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}
