# Contributing

## Set up

```bash
npm ci
cp .env.example .env   # then fill in from your own Supabase project
npm run check
```

Install the supported browsers once before browser tests:

```bash
npx playwright install chromium firefox webkit
npm run test:browser
```

The browser tests deliberately run with no Supabase connection, because that is
the state the deployed site is in whenever the free project is paused or the
room is empty. A test that needs a live room is testing something the site
cannot promise.

## The measurement rule

Do not put a number on the site or in the README unless a committed script
produced it.

```bash
npm run spike     # round trip, send ceiling, presence allowance, a full room
npm run record    # the two recordings the site replays
```

Both point at whatever project is in your `.env` and both send a lot of
messages on purpose. Rerun them against your own project and expect different
milliseconds: the shape of the result is what matters, not mine.

If a rerun changes a headline figure, change the prose with it. The presence
result in particular is asserted in `tests/site.spec.ts` at five of twelve
acknowledged, so a re-recording that disagrees will fail the suite rather than
quietly disagree with the paragraph beside it.

## The design rule

Three sibling repositories share `tokens.css`, `chrome.css` and
`chrome/index.tsx`. Those three files are copies, not a package, and they are
meant to stay identical apart from token values. A change to any of them should
land in all three or in none.

The rest is this site's own: zero border radius, one hairline for every
division, fixed heights on anything that repeats or updates, mono for chrome and
the body face for sentences with nothing in between, and a hue only where a
legend explains it.

## Before opening a pull request

```bash
npm run check
npm run test:browser
```

Keep documentation in British English, plain ASCII, and free of claims the repo
cannot demonstrate.
