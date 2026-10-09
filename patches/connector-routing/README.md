# Native connector authentication alongside Remote Control

The Remote Control relay gives the stock CLI a loopback backend URL. The CLI
then treats hosted `codex_apps` discovery as OAuth rather than managed ChatGPT
authentication. Connected plugins can disappear together even though their
account connections remain valid.

This module supplies the stock per-thread backend override for chat start,
resume and fork requests. Threadless `app/installed`, `app/read` and MCP status/resource
requests use one lazy, ephemeral native context at the official ChatGPT backend.
Remote requests wait for that same context, including before desktop discovery.
It creates no persistent chat and sends no model turns. Connector credentials,
attestation requests, account routing and tool execution remain native.
Explicit request endpoint preferences are preserved.

The adapter hides only its internal context lifecycle notifications and responses,
including broadcasts to remote clients. Remote internal lifecycle broadcasts
become native `pong` transport events with the same sequence/acknowledgement
boundary, so hiding a context does not create a delivery gap.
Other stdio messages pass through unchanged. Remote envelopes retain request
IDs, stream/sequence identity and existing cursors. Segment counts stay unchanged
when the rewritten payload fits; near the native wire limit, extra native segments
reuse the final cursor and preserve the reconnect boundary. Startup has a bounded
queue and a ten-second deadline. Desktop failures return an error; remote failures
use an unavailable context so the native endpoint returns a request-scoped error
while listing and reconnect stay available. Incomplete chunk expiry excludes time
spent waiting on local context creation. Dead contexts recover on the next request.
Historical context IDs are bounded independently of healthy recovery, so a long
desktop session can recover repeatedly. Unknown ephemeral broadcasts can wait
up to the same ten-second identity deadline during startup, then pass through.
When outgoing chunks vary or stall, retained bytes are flushed in arrival order
and lifecycle filtering yields to native pass-through for that connection.
Incoming request validation remains strict. Relay counters expose filter and
routing fallback without including message content.
The context is unsubscribed at EOF and terminates with its owned CLI process.

This module is independently selectable. With `remote-fast-list` disabled,
the CLI already uses native routing and this adapter is unnecessary. With this
module disabled and the relay enabled, the original connector failure can recur.
Existing pairing and private relay state are retained in either selection.

The deprecated `app/list` endpoint retains native behavior: in this CLI release
it ignores session routing overrides. The current desktop uses `app/installed`
for installed connector tools; legacy directory listing is outside this fix.

## Verification

Unit tests cover explicit preferences, desktop/remote routing, remote-first
startup, lifecycle filtering, failure/late responses, unsafe integer request IDs,
chunk metadata and stdio backpressure. Native launcher fixtures exercise the
Python supervisor, Node relay and unmodified bundled CLI. Live connector
inventory acceptance is recorded separately from mock protocol checks and
requires managed authentication; it is not a hosted-CI credential requirement.
