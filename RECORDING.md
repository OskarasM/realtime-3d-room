# Recording script

Target length three minutes. Shot list first, then what to say over each shot.

## Before you start

- Two Chrome windows, each 1280 by 800, side by side on one 2560 wide screen.
  Left window is "you", right window is "them".
- Both on the deployed URL, not localhost. It should look like a thing that
  exists.
- Right window in a fresh incognito profile, so it signs in as a different
  anonymous user and gets a different colour.
- Editor open on `src/net/interpolation.ts` at the `sample` method, font size up
  to about 18px. Nothing else in the tab bar.
- Supabase dashboard open on the SQL editor in a third tab, query already pasted
  but not run.
- Close Slack, mail, and anything that shows a notification.
- Record at 1080p or better. No webcam overlay; the screen is the content.

Record it in one pass per section rather than one pass overall. Sections 3 and 4
are the ones worth retaking.

---

## 1. Cold open (0:00 to 0:12)

**Shot.** Both windows already open, both avatars visible. No narration at all.
Move in the left window with WASD. The right window follows smoothly. Move in
the right window. The left follows.

**Say.** Nothing. Let it run for a full ten seconds. The demo is the hook, and
talking over it suggests it needs explaining.

## 2. What it is (0:12 to 0:35)

**Shot.** Keep both windows. Drag to orbit the camera slowly in the left window
while you talk.

> This is a shared 3D room. React Three Fiber draws it, Supabase Realtime carries
> everyone else in it, and it took a weekend. Two browser windows, no accounts,
> no server of my own. I want to show you the three things that were actually
> difficult, because none of them were the 3D.

## 3. The wall (0:35 to 1:20)

**Shot.** Cut to the README's presence limits table, full screen. Then to the
spike output block showing `5 of 12 acknowledged, first failure at call 6`.

> The obvious way to build this is Supabase presence. It already replicates state
> to everyone in a channel and it handles disconnects for you. So put the
> player's position in the presence payload, and you are done in one line.
>
> Except presence allows five calls per client per thirty seconds. That is one
> update every six seconds. And look at the right hand column: paying does not
> change it. It is the same on every plan.
>
> I measured it rather than trusting the docs. Twelve calls, four hundred
> milliseconds apart. Exactly five got through and the sixth failed.
>
> The part I did not expect is the elapsed time. Those twelve calls took seventy
> five seconds, because a rejected track call does not fail, it hangs until it
> times out. So position on presence is not just too slow. It stalls for ten
> seconds at a time.

**Shot.** Cut to the "Presence carries identity, broadcast carries position"
table.

> So presence carries who you are, which changes once. Broadcast carries where
> you are, ten times a second. They were never the same kind of data.

## 4. The failure, and the fix (1:20 to 2:10)

This is the most important shot in the recording. Do not rush it.

**Shot.** Both windows. Left window: click Interpolation to **off**. Then move
continuously in the right window for a good eight seconds so the stutter in the
left window is unmistakable.

> Here is what ten updates a second actually looks like if you just draw each
> packet as it lands. The screen refreshes sixty times a second, so five frames
> out of six have no new information in them. It teleports.

**Shot.** Click Interpolation back **on**. Move again, same path, same speed.

> Same data rate. Same packets. The difference is that I am no longer drawing the
> newest position.

**Shot.** Cut to the editor, `sample()`, highlight the `renderTime` line.

> Every remote player is drawn a hundred and twenty milliseconds in the past.
> Because that moment is behind us, I have packets on both sides of it, so I can
> interpolate between two positions I actually know instead of guessing at one.
>
> I measured about nine per cent packet loss with eight players connected. With
> this, a lost packet is not a jump, it is just a slightly longer interpolation
> between the two either side of it. You cannot see it happen.

## 5. RLS (2:10 to 2:45)

**Shot.** Left window, open the guestbook panel, show the entries.

> One thing here survives you closing the tab: a guestbook row in Postgres. Which
> makes it the one thing that has to be defended, because the API key that
> reaches it is sitting in a public JavaScript bundle.

**Shot.** Click "Try signing as someone else". Let the red rejection text land.

> That button is a real hostile insert from the browser, signing as a user id
> that is not mine. Row Level Security rejects it. The key is not the security
> boundary, the policy is.

**Shot.** Cut to the SQL editor. Run the update-someone-else query. Point at the
`0 rows` result.

> One thing worth knowing. A blocked insert throws. A blocked update or delete
> does not: it succeeds and affects zero rows, because with no policy granting
> access there is nothing there to modify. If your code only checks for an error,
> it thinks the delete worked.

## 6. Close (2:45 to 3:00)

**Shot.** README top, then the repo URL, then back to both windows moving.

> All of it is open source, MIT, and the guide walks through every number I just
> quoted. Clone it, point it at your own Supabase project, and it runs in about
> ten minutes.

---

## If you need to cut to two minutes

Drop section 2 entirely and shorten section 5 to the button click alone. Keep
sections 3 and 4 whole. The presence limit and the interpolation toggle are the
only parts of this that nobody else's demo has.

---

## An unfinished performance thread, recorded rather than dropped

Lighthouse on the deployed site reports performance in the low 80s against 95
and 96 for the two sibling projects, and the cause is one thing: the 910 kB
React Three Fiber chunk is a static dependency of the entry, so the browser
fetches and parses the whole renderer before it paints anything.

`src/scene/Room.tsx` is lazily imported, and that is correct: it produces its
own chunk and the build lists r3f as that chunk's dependency. It is also
statically reachable, and that is the part not yet solved. The entry chunk
imports two bindings from the r3f chunk. One of them is React's JSX factory,
identified by reading the minified chunk: it has the shape of
`react/jsx-runtime`, which every component in the entry calls.

Naming chunks explicitly fixed this twice and then stopped working:

| Attempt | Result |
|---|---|
| Give React its own chunk | Entry chunk 237 kB to 59 kB. r3f still preloaded. |
| Move zustand in with React | No change. R3F uses zustand, but that was not the edge. |
| Route every unmatched node_modules id to a vendor chunk | No change at all, byte-identical output. |
| Match `jsx-runtime` by name, first rule | No change at all, byte-identical output. |

The last two producing byte-identical output is the useful signal: the id that
`manualChunks` receives for the automatic JSX runtime does not contain
`jsx-runtime` or `node_modules`, so no rule written against the id string can
reach it. It is likely a virtual module id injected by the React plugin.

What is committed is the part that is proven: the React chunk, which is a real
reduction in the entry, and the lazy scene, which is correct on its own terms
and which the browser suite now covers properly. What is not committed is four
rounds of guessing that changed nothing.

The next thing to try is `experimental.renderBuiltUrl` or dropping
`manualChunks` entirely and letting the automatic dynamic-import split do the
work, measured rather than assumed. Whoever picks this up: the check is one
line, and it is the only check that matters.

    grep -o '<link[^>]*modulepreload[^>]*>' dist/index.html

If `r3f` appears in that output, the scene is still in front of first paint,
whatever the chunk listing says.
