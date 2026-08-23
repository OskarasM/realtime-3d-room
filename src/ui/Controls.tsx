import { ArrowIcon } from '../chrome'

/**
 * How to use the room, on the room.
 *
 * This used to be a sentence in the hero underneath the canvas, which is the
 * one place a visitor is not looking when they are deciding whether the black
 * rectangle above it does anything. Putting it over the scene costs no canvas
 * height, because it is positioned rather than laid out, and it answers the
 * only question anybody has in the first two seconds.
 *
 * The second window is the call to action rather than a link to the repository,
 * because opening one is the shortest path to the thing this project is about:
 * two clients, one room, and the gap between them measured in the panel above.
 */
export function Controls() {
  return (
    <div className="controls-strip">
      <p className="controls-keys">
        <span className="controls-label">Walk</span>
        <Key>W</Key>
        <Key>A</Key>
        <Key>S</Key>
        <Key>D</Key>
        <span className="controls-or">or arrow keys</span>
        <span className="controls-rule" aria-hidden="true" />
        <span className="controls-label">Look</span>
        <span className="controls-or">drag anywhere</span>
        <span className="controls-rule" aria-hidden="true" />
        <span className="controls-label">Go</span>
        <span className="controls-or">click the floor</span>
      </p>

      <button
        className="button controls-cta"
        type="button"
        onClick={() => window.open(window.location.href, '_blank', 'noopener')}
      >
        Open a second window <ArrowIcon />
      </button>
    </div>
  )
}

function Key({ children }: { children: string }) {
  return <kbd className="key">{children}</kbd>
}
