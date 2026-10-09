# App-managed runtime synchronization recovery

Reviewed for package 26.1002.7124.0 only. This app-code module is `auto` when needed.

The desktop generates its worker executable, service paths and managed Computer Use pipe during synchronization. A timed-out write can leave a previous deployment's settings saved. This module serializes the existing sync and makes up to three attempts for request timeout, queued expiry or disconnected-app-server errors, waiting one and two seconds. Each attempt re-runs native selection and pipe discovery. Permanent errors retain normal failure behavior.

A local chat config request with no successful sync result coalesces one recovery refresh and requests native user-config reload. Remote hosts retain their original path. Failed bundled reconciliation clears its cached configuration signature; the next ordinary window focus retries current feature selection before external-plugin reconciliation. Successful signatures remain deduplicated. No recurring timer, hardcoded pipe, private environment copy or active-chat restart is added.

Disable independently and rebuild to restore stock behavior. Use with the Browser eligibility/path/recovery modules where needed. Source tests cover bounded retries, fresh pipe generation, concurrent chat recovery, remote-host exclusion, reconciliation failures and subsequent explicit feature disables. Actual Browser and Computer Use tools must be tested after relaunch.

Bundled marketplace reconciliation uses the native throw-on-failure option so a partial marketplace failure cannot be recorded as a successful configuration. Recovery waits for an ordinary focus or the next relevant feature publication; it does not create a background polling loop.

Successful chat recovery is cached for the current connection, reconciliation, sync and feature snapshot. A later native sync or feature publication invalidates that cache; a failed recovery is never cached as success.
