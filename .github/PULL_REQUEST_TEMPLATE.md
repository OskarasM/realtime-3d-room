## What changed

Describe the network, scene or site behaviour this changes.

## Verification

- [ ] `npm run check`
- [ ] `npm run test:browser` when the page changed
- [ ] Any new number came from `npm run spike` or `npm run record`, not from an estimate

## Network review

- [ ] Inbound payloads still go through `parseMove`
- [ ] Nothing new re-renders React at packet rate
- [ ] Every section still reads with no Supabase connection
- [ ] Shared design files are still identical to the sibling repositories
