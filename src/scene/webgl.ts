/**
 * Whether this browser will actually hand over a WebGL context.
 *
 * That is a different question from whether it has heard of WebGL. A locked
 * down work machine, a blocklisted driver, a browser with hardware
 * acceleration switched off and a headless CI runner all expose the API and
 * then refuse the context. Three.js throws when that happens, so without this
 * the visitor gets an uncaught error and a black rectangle with no explanation
 * of what went wrong or whether the rest of the page is worth reading.
 *
 * Asked once, at import, because the answer cannot change while the page is
 * open and every caller wants the same answer.
 */
function detect(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'))
  } catch {
    // Some privacy extensions throw from getContext rather than returning null.
    return false
  }
}

export const WEBGL_AVAILABLE = detect()
