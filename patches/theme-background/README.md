# Configured app background

Applies the configured Codex background to the top bar, outer shell and sidebar as well as the chat. Selecting `#000000` produces black backgrounds; other colors and live light/dark theme changes follow the same setting. This module implements **THEME-1** in the [behavior contract](../../docs/BEHAVIOR_CONTRACT.md).

Stock Codex derives a different `surface-under` color for its sidebar/native window and uses a tinted editor background for its outer shell. This patch assigns the configured theme surface to `--app-color-background-surface-under` and `--app-color-background-shell`. It preserves editor, elevated-control, text, accent, border, hover and selection colors, along with opacity preferences and any separately applied workspace tint.

Reviewed for Windows x64 package **26.1021.3705.0**, app **26.1021.31345**. The archive, target module and independent output hashes are pinned in [compatibility/current.json](../../compatibility/current.json). Older builds have no reviewed implementation of this module; unknown builds still require review. The official installation remains untouched.

## Selection

`theme-background` defaults to `auto`. The next normal toolkit install includes it for a reviewed build, including when the saved selection predates this module. Set it to `disabled` to rebuild from pristine source with stock background behavior. It has no dependencies on other patches. Follow the root [installation instructions](../../README.md); existing running deployments do not change until rebuilt and relaunched.

## Verification

The source tests execute stock and patched theme generators from a supplied pristine archive across 48 color, contrast, variant and opacity combinations. They verify live theme recalculation, independent selection, pristine restoration when disabled, unchanged unrelated colors and archive entries, and rejection of unknown archives. The main source suite also exercises every combination with the other app-code patches and syntax-checks the outputs.

From PowerShell, after setting the archive path for your official installation:

```powershell
$env:CODEX_SOURCE_ASAR = '<official Codex app directory>\resources\app.asar'
node --test tests/theme-background-source.cjs
```

An optional Chromium check renders the actual app styles and shell classes. Set `CODEX_PLAYWRIGHT_MODULE` to a separately installed `playwright` or `playwright-core` module, with its Chromium browser installed, to run it. Without that variable the renderer check is explicitly skipped. The normal compatibility workflow runs the source tests; Chromium rendering is additional evidence, not a CI prerequisite.

See the [dated acceptance evidence](../../docs/acceptance.md). Source-derived rendering is distinct from acceptance in the running Windows desktop app; this change does not restart active chats or activate a deployment.
