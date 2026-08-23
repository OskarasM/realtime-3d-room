import type { ReactNode } from 'react'

/**
 * One section, standing on the time axis.
 *
 * The axis is this site's structural device, in the same way the instrument
 * grid is three-dispose-guard's and the transcript rail is scene-narrator's.
 * Three sites share a token schema, a hairline rule and a 12px gutter, which
 * would make them identical if hue were the only thing separating them, so each
 * one's primary layout axis and repeating unit differ instead. Here the axis
 * runs horizontally, the repeating unit is a tick, and each section is marked
 * with a moment rather than a number: t+0, t+120ms, 5 / 30 s.
 *
 * The marker sits on the rule rather than above it, which is why this does not
 * use SectionHeading from chrome/index.tsx. It reuses that stylesheet's class
 * names, so the two files stay in step.
 */
export function Band({
  id,
  mark,
  title,
  lede,
  children,
}: {
  id: string
  mark: string
  title: string
  lede?: ReactNode
  children: ReactNode
}) {
  const titleId = `${id}-title`

  return (
    <section className="band" id={id} aria-labelledby={titleId}>
      <div className="band-shell">
        <div className="axis">
          <span className="section-number">{mark}</span>
          <span className="axis-rule" aria-hidden="true" />
        </div>

        <div className="section-heading">
          <h2 id={titleId}>{title}</h2>
          {lede ? <p>{lede}</p> : null}
        </div>

        {children}
      </div>
    </section>
  )
}

/** The full-bleed accent strip. Punctuation, used exactly once on this page. */
export function Strip({ children }: { children: ReactNode }) {
  return (
    <aside className="strip">
      <p>{children}</p>
    </aside>
  )
}
