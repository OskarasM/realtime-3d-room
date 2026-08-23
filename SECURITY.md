# Security policy

## What this is

This is an application, not a package. There is nothing to depend on, so there
is no published version to patch. Fixes land on `main` and reach the deployed
site on the next push.

## Reporting a vulnerability

Do not open a public issue containing exploit details.

Report the problem privately through GitHub's security-advisory form for
`OskarasM/realtime-3d-room`. Include:

- What an attacker can reach, and with what: the publishable key is in the
  client bundle by design, so "I have the key" is the starting position rather
  than the finding.
- A minimal reproduction.
- Whether it survives Row Level Security, and which policy it crosses.

You should receive an acknowledgement within seven days. No bounty programme is
currently offered.

## Known and deliberate

These are documented rather than defended, and reporting them is not necessary:

- **Positions are client-trusted.** Every client is authoritative over where its
  own avatar stands. Inbound packets are checked for shape and finiteness and
  clamped to the room in
  [`parseMove`](src/net/protocol.ts), which stops a bad packet permanently
  removing an avatar, but nothing distinguishes walking from teleporting.
- **The eight-person cap is courtesy.** It is enforced by each client
  untracking itself. A scripted client can ignore it and keep broadcasting.
  Enforcing it needs Realtime Authorisation with a policy on
  `realtime.messages`.
- **The channel is public.** One lobby, no private rooms, no accounts.

What is in scope: anything that writes to, reads beyond, or bypasses the
guestbook policies in
[`supabase/migrations/0001_guestbook.sql`](supabase/migrations/0001_guestbook.sql);
anything that escalates the anonymous session; and anything that gets a secret
into the client bundle.
