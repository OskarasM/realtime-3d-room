import { Room } from './scene/Room'
import { Hud } from './ui/Hud'
import { Guestbook } from './ui/Guestbook'
import { Overlay } from './ui/Overlay'
import { useRoom } from './net/useRoom'

export default function App() {
  useRoom()

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#0b0f14] text-slate-100">
      <Room />

      {/* The HUD floats over the canvas. The wrapper ignores pointer events so
          that dragging to orbit the camera still works through the gaps. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <Hud />
          <Guestbook />
        </div>

        <p className="pointer-events-none mx-auto rounded-full bg-black/50 px-3 py-1.5 text-center text-[11px] text-slate-400 backdrop-blur-sm">
          WASD or the arrow keys to move. Tap the floor on a phone. Drag to look around.
        </p>
      </div>

      <Overlay />
    </main>
  )
}
