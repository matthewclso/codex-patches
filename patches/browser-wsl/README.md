# In-app browser with WSL

The Windows renderer still returns `wsl-disabled` solely because Codex is using WSL. This patch removes that branch from the in-app browser eligibility function. Loading states, user browser preferences, model requirements, feature gates, and the chrome-extension window exclusion are retained.

The separate external Chrome browser eligibility function is unchanged. This module does not change browser permissions or security policy. `browser-service-path` addresses a distinct Windows-worker path problem and is normally selected alongside this module.

The exhaustive source-function test compares 256 stock and patched cases. Only otherwise eligible WSL cases may change. Real browser bootstrap and interaction from a Linux repository require desktop acceptance after launching the generated copy.
