# Decisions

Register of settled choices so nobody re-litigates them. Add or update rows; never delete a row, mark it Superseded. No length cap: search the relevant section, do not read in full.

Status: Accepted | Implemented | Open (needs owner) | Deferred (valid later) | Rejected (do not revive without new evidence and owner approval) | Superseded (by row/date)

Rows dated before 2026-09-17 index choices already written in this repository (commit messages, README, CONTRIBUTING.md, SECURITY.md); the source is named in each row.

## Networking and measurement

| Date | Decision | Status | Reason / evidence |
|---|---|---|---|
| 2026-08-21 | Position rides on Supabase broadcast, not presence; presence carries identity only. | Implemented | README "Part one: presence cannot carry position"; presence is rate-limited to 5 calls/30s on every plan. |
| 2026-08-21 | Remote players render `RENDER_DELAY_MS` (120 ms) in the past, interpolating between held snapshots, rather than drawing the newest packet. | Implemented | README "Part two"; `src/net/interpolation.ts`. |
| 2026-08-21 | No clock synchronisation between browsers; every snapshot is timestamped on arrival with the receiver's own clock. | Implemented | README "Three details in interpolation.ts". |
| 2026-08-21 | Hold last known pose rather than extrapolate on velocity when packets stop arriving. | Implemented | README "We hold rather than extrapolate". |
| 2026-08-23 | No number appears in the README or on the site unless a committed script (`npm run spike`, `npm run record`) produced it. | Implemented | CONTRIBUTING.md "The measurement rule". |
| 2026-08-23 | The room caps at 8 concurrent players, derived from the measured 100 msg/s project broadcast budget at 10 Hz per player. | Implemented | README "The split" / "How fast can broadcast actually go". |

## Security and trust boundary

| Date | Decision | Status | Reason / evidence |
|---|---|---|---|
| 2026-08-23 | Every client is authoritative over its own position; inbound packets are validated for shape and finiteness and clamped, but walking versus teleporting is not distinguished. | Accepted | SECURITY.md "Known and deliberate"; `parseMove` in `src/net/protocol.ts`. |
| 2026-08-23 | The eight-person cap is client-enforced courtesy only; a scripted client can ignore it. | Accepted | SECURITY.md "Known and deliberate"; would need Realtime Authorisation on `realtime.messages` to close. |
| 2026-08-23 | The Supabase channel is one public lobby with no accounts or private rooms. | Accepted | SECURITY.md "Known and deliberate". |
| 2026-08-23 | The publishable Supabase key is intentionally public in the client bundle; the guestbook is protected by Row Level Security policy, not by hiding the key. | Implemented | README "Run it yourself" step 2; `supabase/migrations/0001_guestbook.sql`. |

## Repository and release

| Date | Decision | Status | Reason / evidence |
|---|---|---|---|
| 2026-08-23 | This is an application, not a package; it is not published to npm and has no importable surface beyond two files meant to be copied and read, not depended on. | Accepted | README "This one is not on npm, and should not be". |
| 2026-08-23 | Tailwind removed in favour of a plain stylesheet (zero border radius, one hairline, fixed row heights). | Implemented | CHANGELOG.md 2026-08-23 "Removed"; CONTRIBUTING.md "The design rule". |
| 2026-08-23 | `src/tokens.css`, `src/chrome.css` and the chrome layout are copied, not packaged, across three sibling repositories; a change lands in all three or none. | Deferred | CONTRIBUTING.md "The design rule"; revisit if a fourth sibling appears (pattern shared with three-dispose-guard's token-schema decision). |
| 2026-08-23 | Documentation and code comments use British English and plain ASCII, enforced by `scripts/check-prose.mjs`. | Implemented | `npm run check`; CONTRIBUTING.md closing line. |
| n/a | `.github/workflows/keepalive.yml` reads the guestbook every three days to stop the free Supabase project pausing. | Implemented | Commit "Keep the free Supabase project awake with a read every three days" (09a73ac, 2026-09-16). |

## Agent setup

| Date | Decision | Status | Reason / evidence |
|---|---|---|---|
| 2026-09-17 | AGENTS.md is the shared agent contract (seven sections, checked in CI by a vendored checker in `.github/agent-setup/`); docs/STATE.md, docs/ROADMAP.md and this file hold current state, plan and decisions; CHANGELOG.md stays the change history. | Accepted (owner) | Owner-approved setup pattern (decision #3, 2026-09-14); checker source and hashes in `.github/agent-setup/SOURCE.md`. |
| 2026-09-17 | CLAUDE.md is local-only in this public repository (excluded via `.git/info/exclude`); CI does not require it. | Accepted (owner) | Owner decision #3, 2026-09-14, for public repositories. |
| 2026-09-17 | The vendored `repo-policies.json` holds only this repository's own entry, filtered from the owner's private mapping. | Accepted (owner) | Owner decision, 2026-09-17; the source file otherwise names private repositories. |
| 2026-09-17 | The contract check runs as a step in the existing `check` CI job instead of a new job. | Accepted (agent proposal) | This repository has no branch-protection required checks configured today; the step still exercises the checker on every push and pull request without adding a job. |
| 2026-09-17 | `scripts/check-prose.mjs` skips the `agent-setup` directory. | Accepted (agent proposal) | The vendored checker must stay byte-identical to its source hash and contains an American spelling that this repository's prose rule would otherwise flag. |
