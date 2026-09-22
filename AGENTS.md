# realtime-3d-room

Shared project instructions for contributors and coding tools. Current user instructions override these repository defaults. Observed code, configuration and verified live state override stale descriptions; reconcile the documents when they disagree.

## Product

- Audience: developers evaluating Supabase Realtime for a multiplayer 3D scene, and visitors to the live demo.
- Primary goal: a shared 3D room (React Three Fiber scene, Supabase Realtime for presence and position) that demonstrates, with committed measurements, why position cannot ride on presence and how snapshot interpolation hides broadcast jitter and loss (README "Why this exists").
- Success metric: not documented in the repository (owner question in docs/STATE.md). Evidence in use today: every CI check green, headline numbers backed by a committed `npm run spike`/`npm run record` run, and the keepalive job keeping the free Supabase project reachable.
- Non-goals: publishing this repository as an npm package - it is an application with no importable surface (README "This one is not on npm, and should not be"); server-enforcing the eight-person room cap or position authority (SECURITY.md "Known and deliberate").
- Detail: `none`

## Stack

- TypeScript 5, React 19, Vite 8, React Three Fiber for the scene, Zustand for client state.
- Supabase Realtime (presence for identity, broadcast for position) and Postgres with Row Level Security for the guestbook table.
- Hosting: Vercel, deployed from `main` (vercel.json). `.github/workflows/keepalive.yml` reads the guestbook every three days so the free Supabase project is not paused.
- Node engines not pinned in package.json; CI runs Node 24.

## Commands

Run from the repository root; package.json scripts are the source of truth. Verify current commands in the manifest and CI; do not invent scripts.

- Install: `npm ci`
- Dev: `npm run dev`
- Lint: none
- Typecheck: `npm run typecheck`
- Test: `npm test`
- Build: `npm run build`
- Browser tests (install once: `npx playwright install chromium firefox webkit`): `npm run test:browser`
- Aggregate gate: `npm run check` (typecheck, prose, font budget, unit tests, build)
- Measurement scripts, against your own Supabase project in `.env`: `npm run spike`, `npm run record`
- Project contract check (vendored, see `.github/project-check/SOURCE.md`): `node .github/project-check/check.mjs --ci --repo-id realtime-3d-room .`

## Conventions

- Default branch `main` is production; Vercel deploys from it on every push. Work on a branch; merge by pull request only.
- This repository is public. Never commit tokens, project IDs, private paths or personal details beyond what SECURITY.md already discloses; report vulnerabilities through GitHub security advisories.
- No number belongs in the README or the site unless a committed script produced it (CONTRIBUTING.md "measurement rule"); rerun `npm run spike`/`npm run record` and update the prose together when a rerun changes a headline figure.
- `src/tokens.css` and `src/chrome.css` are copied identically across three sibling repositories; change all three or none (CONTRIBUTING.md "design rule").
- Documentation and code comments use British English and plain ASCII (no smart quotes, en or em dashes, or the ellipsis character); `node scripts/check-prose.mjs` enforces it.
- No co-author trailers in commits.
- Never edit: `dist/`, `node_modules/`.

## Project docs

Read the smallest set the task needs. Files marked "search only" are never read in full.

| file | holds | read |
|---|---|---|
| `docs/STATE.md` | stage, Now (max 3), blockers, last verified checks | start of substantive work |
| `docs/ROADMAP.md` | Next, Later, Parked, Out of scope for now | before feature or scope work |
| `docs/DECISIONS.md` | decision register: status and reason | search the relevant section before changing direction |
| `CHANGELOG.md` | change history | search only |
| `CONTRIBUTING.md`, `SECURITY.md` | setup, the measurement rule, the design rule; security policy and the deliberate risk acceptances | before code, measurement or security work |
| `spike/RESULTS.md`, `RECORDING.md` | measurement methodology and recorded traces | before changing a measured claim |

A current explicit user request authorises its scope even if absent from these docs. Ask before expanding that scope materially. Revisit rejected decisions only with new evidence; explain the tradeoff.

## Done = verified

Work is done only when these pass, run in this order, output read. `npm run check` runs typecheck, prose, font budget, unit tests and build.

1. `npm run check`

- Browser-visible, WebGL or demo change: also `npm run test:browser`.
- Before opening a pull request (CONTRIBUTING.md): also `npm run test:browser`.
- Changing a headline number: rerun `npm run spike`/`npm run record` from your own Supabase project and update the prose in the same change; `tests/site.spec.ts` asserts some of these values.
- Docs-only change: prose check, links, consistency with package.json scripts and CI, `git diff --check`, and the project contract check.
- Update only project docs whose facts changed: `docs/STATE.md` (Now, blockers, Last verified, Updated date), `docs/DECISIONS.md` (new or changed decisions with reason), `docs/ROADMAP.md` (items moved or added), a `CHANGELOG.md` entry for user-visible changes.
- Report which checks ran and their result. Never skip, weaken, or delete a check to make it pass.

## Design

Visual design: `none (not documented)`. `src/tokens.css` and `src/chrome.css` carry the token schema and chrome layout shared with two sibling repositories (CONTRIBUTING.md "design rule"); read them before any UI or token change.
