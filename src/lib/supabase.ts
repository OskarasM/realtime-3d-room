import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
// New projects call this the publishable key (sb_publishable_...). Older ones
// call the same key the anon key (eyJ...). Both work, so accept either name.
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && key)

/**
 * Missing configuration is the single most likely thing to go wrong for someone
 * who has just cloned this, so it fails with an instruction rather than a
 * TypeError three files away.
 */
export const configError = isConfigured
  ? null
  : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env, then restart the dev server. See .env.example.'

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  // Note for anyone porting an older tutorial: realtime-js used to take a
  // `realtime: { params: { eventsPerSecond } }` client-side throttle. It is
  // gone in 2.112.x (grep the package, there are zero references). Rate
  // limiting is the server's job now, and budgeting the send rate is ours.
  // See src/net/protocol.ts for the budget.
})
