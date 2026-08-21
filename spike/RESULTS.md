# Spike results

Raw output of `npm run spike`, kept so the numbers in the README have a source.

Measured 21 August 2026, against a free plan project in `eu-west-1`, from a
domestic connection in the UK. Rerun it against your own project and expect
different latency: the shape of the result is what matters, not my milliseconds.

```
1. Broadcast round trip, self-echo, 120 samples at 10 Hz
   p50 27 ms, p95 33.3 ms, max 46 ms, 120 returned

2. Send rate ceiling, acknowledged sends, one client
    10 Hz: 100% acknowledged, socket alive
    20 Hz: 100% acknowledged, socket alive
    40 Hz: 100% acknowledged, socket alive
    60 Hz: 100% acknowledged, socket alive
    80 Hz: 100% acknowledged, socket alive
   100 Hz: 100% acknowledged, socket alive
   140 Hz: 100% acknowledged, socket alive
   200 Hz: 100% acknowledged, socket alive

3. Presence call limit, 12 track() calls
   5 of 12 acknowledged, first failure at call 6, over 75093 ms

4. Full room, 8 clients at 10 Hz for 12 seconds
   763 of ~840 expected messages delivered (90.8%),
   inter-arrival p50 109 ms, p95 121.6 ms
```

## Reading these

**The presence result is the one that decided the architecture.** Exactly five
calls succeeded and the sixth failed, which matches the documented allowance of
five presence calls per client per thirty seconds precisely.

The elapsed time is the other half of that finding. Twelve calls spaced 400 ms
apart should take under five seconds. It took seventy five. A rejected `track()`
does not fail fast, it hangs until the client side timeout, so a naive
implementation that sends position on presence does not merely drop updates, it
blocks for ten seconds at a time while doing it.

**The send ceiling did not appear where the documentation suggests.** The free
plan documents 100 messages per second, and a single client held 200 Hz for
three seconds with every send acknowledged and the socket intact. Do not read
that as permission to send at 200 Hz. The quota is per project rather than per
client, these were three second bursts rather than sustained load, and the room
result below shows aggregate pressure behaving very differently. The honest
summary is that a single client sending briefly is not what the limit is aimed
at.

**Eight clients at 10 Hz is 80 messages a second in aggregate, under the
documented 100, and 9.2 per cent of messages still went missing.** That is the
number that matters for the design. Losing about one packet in eleven is exactly
why the client renders slightly in the past and holds the last known pose rather
than extrapolating: a dropped packet becomes a slightly longer interpolation
between the two either side of it, which nobody sees, instead of a visible jump.

The inter-arrival figures say the same thing from the other side. A 10 Hz stream
should arrive every 100 ms; the median gap was 109 ms and the 95th percentile
121.6 ms. The 120 ms render delay was chosen before these were measured and
turns out to sit almost exactly on that 95th percentile, which is the right
place for it.

## A hazard worth knowing about

While developing the spike I saw `realtime-js` print this, repeatedly:

```
Realtime send() is automatically falling back to REST API.
```

It does that whenever you call `send()` on a channel whose socket is not in the
joined state, and it does not throw. Each message quietly becomes an individual
HTTP POST instead. An app that sends position ten times a second and gets this
wrong keeps appearing to work while issuing ten HTTP requests a second per
player.

The spike counts these rather than letting them scroll past. In the measured run
above, with sends correctly sequenced after `SUBSCRIBED`, the count was zero.
