import { useEffect, useRef } from 'react'

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}

export type Held = { up: boolean; down: boolean; left: boolean; right: boolean }

/**
 * Held keys in a ref, not in state. A keydown that re-rendered the tree would
 * be a re-render on every keypress for something only useFrame ever reads.
 *
 * Keyed off event.code rather than event.key, so WASD still lands on the same
 * physical keys for someone on an AZERTY or Dvorak layout.
 */
export function useKeyboard(onInput?: () => void) {
  const held = useRef<Held>({ up: false, down: false, left: false, right: false })

  useEffect(() => {
    const set = (code: string, value: boolean) => {
      const dir = KEYS[code]
      if (!dir) return false
      held.current[dir] = value
      return true
    }

    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (set(e.code, true)) {
        e.preventDefault()
        onInput?.()
      }
    }
    const up = (e: KeyboardEvent) => set(e.code, false)
    // Alt-tabbing away with a key held would otherwise leave you walking forever.
    const blur = () => (held.current = { up: false, down: false, left: false, right: false })

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [onInput])

  return held
}
