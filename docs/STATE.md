# State

Updated: 2026-09-17

Overwritten, not appended. History goes to CHANGELOG.md and git. Max 150 lines.

## Stage

Maintained application. Deployed to Vercel from `main` at 09a73ac (2026-09-16); free Supabase project kept awake by `.github/workflows/keepalive.yml`. No library change since the 2026-08-24 fix; no open issues or pull requests before this setup branch.

## Now

Max 3 items.

- [ ] Review the agent setup pull request (AGENTS.md contract, vendored contract checker in CI, project docs) - gives every agent the same rules and a checked definition of done - branch `chore/agent-setup`, draft PR.

## Blockers

- none

## Open questions for the owner

- Success metric: the repository documents quality gates and measurement discipline but no adoption or usage target. Is there one, or is "every claim backed by a committed measurement" the goal?
- Design documentation: `src/tokens.css` and `src/chrome.css` are shared with two sibling repositories but no design document exists (AGENTS.md Design says `none (not documented)`); a ROADMAP item proposes writing one without redesigning anything - confirm scope before it is written.
- The production build warns that the R3F/Three chunk is about 911 kB before gzip, over the 500 kB default threshold; low priority since the room is the whole page and nothing else waits behind it. Worth a ROADMAP item, or accepted as-is?

## Last verified

2026-09-17T20:27Z: `npm ci`, `npm run check`, `node C:/Users/om117/projects/agent-setup/check.mjs --repo-id realtime-3d-room .` - all pass (35 unit tests; typecheck, prose and font-budget clean; production build succeeds with the pre-existing chunk-size warning noted above).

- Revision: 09a73ac (clean worktree of origin/main), repeated on the setup branch.
- Working directory: repository root.
- Evidence: `C:/Users/om117/worktrees/_rollout-evidence/realtime-3d-room/EVIDENCE.md`; pull request CI run for the setup branch.
