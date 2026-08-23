import { ArrowIcon } from '../chrome'
import { REPO_URL } from '../site'

/**
 * The end of the page.
 *
 * It used to stop on a paragraph explaining why this is not on npm, which is
 * true, worth saying once in the README, and a flat note to leave a reader on.
 * A page that argues for measuring things should close by asking you to measure
 * them.
 */
export function CtaBand() {
  return (
    <section className="cta" aria-labelledby="cta-title">
      <div>
        <span className="cta-kicker">Measure it yourself</span>
        <h2 id="cta-title">Every number here is reproducible.</h2>
      </div>
      <a className="button button-large" href={REPO_URL}>
        Read the full guide <ArrowIcon />
      </a>
    </section>
  )
}
