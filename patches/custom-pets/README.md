# Custom pets

The stock Windows pet loader can combine a Windows-normalized Codex home with the POSIX path API used by its WSL backend. Discovery returns no pets, selection cannot read them, and installation targets malformed paths.

This retains the existing fix: normalize the home through Codex's own path converter only when the backend path API uses `/`. Three call sites cover discovery, selected-pet loading, and installation. Native Windows paths and validation of avatar IDs retain their existing behavior.

The installed Store files are read-only. This patch changes one packed JavaScript module in the generated application copy. It adds no drag, input, tracing, or polling hooks.

`tests/app-patches-source.cjs` evaluates the actual installed loader and schema with a fake filesystem. No user pet files are read or written. Retire this module only when the same stock regression cases pass after a Codex update.
