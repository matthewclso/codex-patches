# WSL project paths

This module normalizes root paths only in `project/create`, `project/import`,
and `project/update` JSON-RPC requests. Windows drive paths use discovered mount
mappings or `wslpath`. UNC paths translate only when their distribution matches
the selected backend. Other requests and all responses pass through unchanged.

The WSL entrypoint is `proxy.py`. `CODEX_PATCHES_RUNTIME_CONFIG` names the private
runtime JSON created by the installer. Non-app-server commands, help/schema
commands, and non-stdio servers execute the stock CLI directly. Every launch
checks its supported binary hash; app-server startup also checks its version.

When `remote-fast-list` is selected, the same adapter supervises its Node runner
instead of starting another proxy stack. EOF and signals terminate only this
owned backend process.
