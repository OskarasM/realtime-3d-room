# Changelog

All notable changes are documented here. This is an application rather than a
package, so there is nothing published to version. Dates are when the change
reached `main`.

## 2026-08-23, later

### Added

- A WebGL capability check in `src/scene/webgl.ts`. A browser that exposes the
  API and then refuses a context, which is what a machine with hardware
  acceleration switched off does, previously produced an uncaught Three.js error
  and a black rectangle. It now gets a sentence saying what happened and that
  the rest of the page does not need WebGL.

### Fixed

- The font assertion compared against `FontFace.family` directly. Firefox
  reports that family with the quotes from the `@font-face` descriptor still
  attached where Chromium and WebKit strip them, so a passing site failed in one
  browser for no reason to do with fonts.
- The skip link assertion required the first Tab to land on it. WebKit leaves
  links out of the tab order until the reader turns on a preference that is off
  by default, so the link is now proved reachable and functional everywhere and
  first in the tab order where links participate in it.

### Changed

- Continuous integration no longer sets placeholder Supabase credentials. They
  made the client attempt a request to a host that does not resolve, which
  WebKit reported as a page error, and they contradicted the browser suite's own
  premise: every assertion in it is written to hold with no project reachable.

## 2026-08-23

### Added

- A full site under the room: seven sections marked on a horizontal time axis,
  scrolling past a canvas that keeps the room at `/`.
- Two committed recordings, `src/data/rate-probe.json` and
  `src/data/packet-trace.json`, produced by `spike/record-trace.ts` against a
  real project, so every measured claim on the page works with no Supabase
  connection at all.
- `src/net/replay.ts`, which feeds the recording into the application's own
  `SnapshotBuffer` with adjustable extra delay and deterministic packet loss.
- Side-by-side comparison of `sample()` against `sampleRaw()` from one buffer,
  which is the argument this project exists to make.
- Both guestbook attacks promoted onto the page: the insert that is refused with
  an error, and the update that succeeds, changes nothing, and says nothing.
- Live per-sender inter-arrival measurement in the HUD, and a count of inbound
  packets refused by validation.
- Four self-hosted subset typefaces at 103.6 kB with metric-matched fallbacks,
  the shared token schema, and the portable chrome layer shared with the two
  sibling repositories.
- Social preview metadata, a canonical link, a favicon and an Open Graph image.
- Fifteen Playwright tests including axe at WCAG 2 A and AA, font loading, 44px
  targets and horizontal overflow at four widths.
- `scripts/check-prose.mjs` and `scripts/check-font-budget.mjs`, both wired into
  `npm run check`.
- Security headers and a Content Security Policy in `vercel.json`, with
  `connect-src` scoped to Supabase over https and wss.
- Contributing, security, code of conduct, issue and pull request templates.

### Fixed

- The viewport meta carried `maximum-scale=1.0, user-scalable=no`, which blocked
  pinch zoom and failed WCAG 1.4.4.
- Inbound broadcast payloads went into the snapshot buffer unchecked. Any client
  on the channel could put `NaN` into a Three.js transform, and `NaN` survives
  every interpolation after it, so the avatar never returned. `parseMove` now
  validates shape and finiteness and clamps to the same wall constant the local
  player uses.
- Three scrollable regions could not be reached by keyboard, and one control was
  40px tall. Both were found by the new browser tests rather than by review.
- Signing the guestbook twice returned a 409 and logged an error for behaviour
  that was working exactly as intended.
- The local movement clamp and the room boundary were two separate constants.

### Removed

- Tailwind. The design here wants zero border radius, one hairline for every
  division and fixed row heights, and expressing that in utility classes was
  longer than the stylesheet that replaced it.
