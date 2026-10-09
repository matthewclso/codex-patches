# Browser feature discovery recovery

Reviewed for package 26.1002.7124.0 only. This app-code module is `auto` when needed.

A failed `experimentalFeature/list` request previously made the Browser capability false even when the query retained a successful response. The desktop could then remove the bundled Browser plugin. This module retains the last confirmed config feature value during a query error. With no confirmed result, Browser remains pending and the existing desktop publisher waits. Confirmed workspace policy denial and explicit feature disable still disable Browser; other capabilities retain stock behavior.

This does not enable an otherwise ineligible account or replace `browser-wsl` or `browser-service-path`. Disable independently and rebuild from pristine files to restore stock discovery behavior. Source tests execute the actual capability callback and Browser hook. A new deployment still requires actual agent navigation and link interaction for acceptance.

Retention is restricted to timeout, queued-expiry and disconnected-server failures. Other errors, including authorization failure, retain stock denial behavior.
