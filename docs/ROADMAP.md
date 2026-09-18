# Roadmap

Updated: 2026-09-17

Forward plan only. Shipped work leaves this file (CHANGELOG.md + git). Rejected ideas live in docs/DECISIONS.md. Max 250 lines.

Drafted from repository evidence (README, CONTRIBUTING.md, SECURITY.md, CHANGELOG.md, build output). Items are agent proposals until the owner orders them.

## Next

Ordered. Top item moves to STATE Now when started.

1. Merge the agent setup pull request - done when CI (`check` job, including the vendored contract check) passes and the owner merges.
2. Document the shared design system (`src/tokens.css`, `src/chrome.css`, the chrome layout) - AGENTS.md Design currently says `none (not documented)` even though CONTRIBUTING.md's "design rule" describes it - done when a design document lists the existing tokens, type and layout rules without redesigning anything, and AGENTS.md points to it.

## Later

- Decide the success metric named in docs/STATE.md open questions (owner decision).

## Parked

- Production build warns the R3F/Three chunk (about 911 kB before gzip) exceeds the default 500 kB threshold - the room is the entire page, nothing else waits behind it, and no measured problem has been reported - revisit if initial load time becomes a measured concern.

## Out of scope for now

- Publishing this repository as an npm package - README: "This one is not on npm, and should not be"; it has no importable surface.
- Server-side enforcement of the eight-person room cap or of client position - SECURITY.md "Known and deliberate" documents both as accepted, not defended.
