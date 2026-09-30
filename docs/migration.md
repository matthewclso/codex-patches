# Migrating the historical launcher

The old launcher is not a runtime dependency of this repository. Migrate its private relay route with `install -ImportRelayState /absolute/linux/path/runtime.json` to retain existing enrollment mappings. Do not publish that file. If the module is disabled, native enrollment rows remain available and unchanged.

Keep the old launcher until `doctor` passes and the new shortcut has been used for the interactive checks in [acceptance.md](acceptance.md). Other running chats may still be using the historical Python proxy or relay code. The toolkit does not stop those processes.

Review the legacy removal plan from Windows PowerShell:

```powershell
.\codex-patches.ps1 cleanup-legacy
```

If an extra wrapper script launches the historical toolkit, provide its absolute path using `-LegacyWrapper`. The plan records recognized shortcut references, home junctions, the old Linux supervisor and the historical `%USERPROFILE%\.codex-wsl-launcher` tree. `-LegacyRoot` can select that same-named directory under a different profile location. Plan output is private to your installation.

After completing the interactive checks and switching away from the old launcher:

```powershell
.\codex-patches.ps1 cleanup-legacy -Apply -DesktopAccepted
```

The command refuses removal while old processes are using these paths. It redirects only shortcuts that reference the old launcher, validates junction targets, removes the historical proxy only if its link/content are recognized, and preserves diagnostic files and browser sandbox data under `InstallRoot/legacy-data`. Shared Codex data, histories, enrollment state, and project/relay backups outside the old code tree stay in place. Changed links or unrecognized paths require manual review.

The new installation is rebuilt through `git pull`, `install`, and `doctor`. It contains no dependency on the old launcher. Retain the private data backups as long as you need their audit or rollback history; they are separate from executable patch code.
