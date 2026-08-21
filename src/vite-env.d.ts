/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  /** New projects: sb_publishable_... */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Older projects call the same key the anon key: eyJ... */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
