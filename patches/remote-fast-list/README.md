# Native Remote Control task listing

The stock CLI remains the Remote Control protocol owner. A capability-protected
loopback relay changes incoming remote `thread/list` requests to
`useStateDbOnly: true`. Pagination, filters, request IDs, delivery sequences,
cursors, reconnects, authentication, and outgoing responses remain native.
Chunked messages retain their segment metadata. Other HTTP requests and
WebSockets stream through; TLS certificate checks and configured HTTP(S)
network proxies remain enabled.

The direct native stock regression is narrower than a general listing failure:
on CLI `0.159.0` and `0.159.2`, project-filtered remote lists already use the
SQLite path, while unfiltered remote lists still fall back to rollout-file
history. Disposable database-only witnesses are omitted by stock unfiltered
requests both with `useStateDbOnly: false` and with that field absent. The relay
returns those same witnesses and preserves pagination through reconnect.

The CLI needs a loopback backend URL to reach the relay. Account routing that
reports the default `NO_CONSTRAINT` backend is translated back to the original
`https://chatgpt.com` origin; explicit residency and account routing overrides
remain as supplied by the backend.

The independently selectable [connector-routing](../connector-routing/README.md)
module restores native hosted connector authentication alongside this relay.
Its additional chat/discovery overrides preserve the remote listing behavior.

## Pairing and updates

The private relay capability and port live in `stateRoot/relay/runtime.json`,
independently of Codex and toolkit versions. The launcher never resets pairing
or modifies enrollment records. Setup uses a separate explicit operation:

```text
node patches/remote-fast-list/configure.cjs --config=/absolute/runtime.json
node patches/remote-fast-list/configure.cjs --config=/absolute/runtime.json --apply
node patches/remote-fast-list/configure.cjs --rollback=/absolute/routing-backup
```

The default is a plan without filesystem or database mutation. Apply creates
the route, takes a consistent SQLite backup, and adds a local routing row for
each existing stock enrollment. The original rows, server/environment identity,
and user enable/disable preferences are preserved. Fresh installation with no
database prepares only the route; native first enrollment proceeds normally.
An identity conflict aborts the transaction. Rollback removes only the exact
rows recorded by the migration and refuses concurrent changes.

Disabling this patch restores native routing because stock enrollment rows
remain present. Retain stable relay state when reinstalling or updating the
toolkit. It contains local routing state, not a newly minted backend token.

## Verification

Portable tests cover wire fidelity, boundaries, proxy forwarding, HTTP streaming,
handshake errors, account routing, stable configuration, migration and rollback.
Set `CODEX_RELAY_TEST_BINARY` to the supported stock Linux CLI for native mock
upstream tests inside WSL. Their homes/databases and credentials are disposable;
they never load the user's authentication or make a model request. Native
reconnect tests demonstrate the protocol path; a real phone remains a separate
desktop acceptance check.
