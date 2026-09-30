# Codex patches

Modular compatibility fixes for the **Windows x64 Codex desktop app using an Ubuntu 26.04 LTS WSL2 backend**. Windows 11 is the supported desktop. CI uses hosted Windows Server 2025 runners.

This is an independent community project. It builds an owned app copy from your installed, signed Codex package. It never edits the Store package and does not redistribute Codex binaries. Changing the copy's Electron archive-integrity resource makes its executable's original Authenticode signature invalid. Features that require a signed executable can still reject the copy. The stock launcher remains available.

## Install

Install official Codex and Ubuntu 26.04 LTS under WSL2. Open Codex once, sign in and select the WSL backend in Settings. Git and Windows PowerShell 5.1 are required; the toolkit uses Codex's bundled Windows Node and provisions a checksum-pinned Linux Node inside its own WSL state directory. It does not change shell profiles. Python 3 and `wslpath` come with Ubuntu.

From **Windows PowerShell**, clone the repository into any writable Windows directory:

```powershell
git clone https://github.com/matthewclso/codex-patches.git
cd codex-patches
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-patches.ps1 inspect
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-patches.ps1 install
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-patches.ps1 doctor
```

Close Codex normally and open **Codex - Patched** on your desktop. No processes are terminated by installation or launch. The package-context preflight exercises an isolated Windows → WSL → stock app-server handshake without your credentials, threads or provider requests. It does not prove interactive pet rendering, browser interaction or real phone reconnects; see [acceptance](docs/acceptance.md).

By default, the installer uses the default WSL distribution, `%USERPROFILE%\.codex`, and the Linux user's `~/.codex/sqlite`. Override discovery when needed:

```powershell
.\codex-patches.ps1 install -Distro Ubuntu -CodexHome D:\CodexData -SqliteHome /home/example/.codex/sqlite
```

The installation lives in `%USERPROFILE%\.codex-patches`. `-InstallRoot` changes it (choose a directory outside LocalAppData to avoid packaged-app filesystem redirection) and `-NoShortcut` suppresses shortcut creation. The WSL supervisor command is a toolkit-owned `/usr/local/bin/codex-patches-proxy` symlink, created through `wsl -u root`; installation does not require an elevated Windows shell or an interactive sudo password. Only one Windows user's toolkit installation may own this command in a given distro.

The installer creates **Codex - Patched** on your Windows desktop by default. To recreate that shortcut without rebuilding the app, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-patches.ps1 shortcut
```

Pass the same `-InstallRoot` if you installed in a custom directory. The shortcut uses the installed launcher, so moving or deleting the repository checkout does not break it. Existing pinned icons may still open the previous launcher; use **Codex - Patched** when switching to this installation.

## Select patches

Every patch has its own directory, source audit and tests. Copy `config.example.json`, then change each mode to `auto`, `enabled` or `disabled`:

```powershell
Copy-Item config.example.json config.local.json
.\codex-patches.ps1 install -Config .\config.local.json
```

`auto` includes only fixes reviewed as needed for the installed build. `enabled` still requires an audited implementation and known hashes; it cannot force a patch onto an unknown build. `disabled` rebuilds from pristine files with that module omitted. Each module can be toggled independently.

| Module | Behavior |
| --- | --- |
| [custom-pets](patches/custom-pets/README.md) | Fix pet discovery, selection and installation across Windows/WSL paths. |
| [browser-wsl](patches/browser-wsl/README.md) | Remove the in-app browser's WSL eligibility rejection while keeping other prerequisites. |
| [browser-service-path](patches/browser-service-path/README.md) | Register the browser service with a Windows path for the Windows worker. |
| [project-memberships](patches/project-memberships/README.md) | Optional native synchronization of desktop project assignments to the backend; disabled by default. |
| [wsl-project-paths](patches/wsl-project-paths/README.md) | Translate Windows drive and matching WSL UNC project roots at the JSONL boundary. |
| [remote-fast-list](patches/remote-fast-list/README.md) | Add the required listing options on the Remote Control transport while running the unmodified bundled CLI. |

The audited build, source hashes, evidence and retired workarounds are in [compatibility/current.json](compatibility/current.json). Runtime injections, drag hooks and old custom Rust CLI binaries are not installed. Unknown builds fail closed; `.\codex-patches.ps1 stock` explicitly opens the signed app.

`project-memberships` requires explicit opt-in, including after updating an older saved configuration. Inspect `repair-projects` first: the native initial synchronization follows recorded desktop assignments and can overwrite a conflicting backend membership. Enabling it also persists future task creation, moves and cleared assignments. Disabling it does not undo memberships already written. See its [module documentation](patches/project-memberships/README.md) before setting it to `enabled` or `auto`.

## Update and clean up

After updating Codex, close the patched app, then:

```powershell
git pull --ff-only
.\codex-patches.ps1 inspect
.\codex-patches.ps1 install
.\codex-patches.ps1 doctor
.\codex-patches.ps1 cleanup          # review old generated copies
.\codex-patches.ps1 cleanup -Apply   # remove unused copies
```

The saved configuration is reused. The installer snapshots its runtime and launcher, verifies the source and generated hashes, then replaces its active pointer. Pulling the repository alone does not change the running deployment. Existing snapshots are retained until cleanup checks that they are not in use.

Private relay state survives rebuilds so updates retain the same local route and existing server identities. Installation adds missing route mappings with a SQLite backup; startup never migrates account state. To migrate an existing installation, pass `-ImportRelayState /absolute/linux/path/runtime.json`; the import preserves its port and capability without displaying the capability. Stop the old launcher before switching. Keep the old files until the new workflow's interactive checks pass. [Migration cleanup](docs/migration.md) provides a reviewable plan and removes recognized legacy code only after those checks.

## Maintenance and removal

Project membership repair is explicit, uses recorded project identity rather than guessing from folder paths, and creates backups before applying:

```powershell
.\codex-patches.ps1 repair-projects
.\codex-patches.ps1 repair-projects -Apply
.\codex-patches.ps1 uninstall
.\codex-patches.ps1 uninstall -Apply
```

Close Codex before applying a membership repair or uninstalling. Removal deletes only recorded toolkit outputs and conditionally removes its own shortcut/link; it preserves Codex data and private relay/pairing backups. [Runtime documentation](docs/runtime.md) describes conditional enrollment rollback. Restoring the signed app requires only using its normal shortcut or the `stock` command.

## CI and contributing

[CI design](docs/ci.md) describes deterministic scheduled update proposals, signed-package checks, hosted WSL2 feasibility evidence and source-only releases. Proposals are drafts for review; they do not automatically enable changed code or retire a patch solely because an anchor disappeared. No agent or API key is required.

For development, use Node 24 and `npm ci --ignore-scripts`, then `npm test`. Set `CODEX_SOURCE_ASAR`, `CODEX_SOURCE_EXE` and (inside WSL) `CODEX_RELAY_TEST_BINARY` to pristine installed binaries to run actual-source and native integration tests. Fixtures use isolated data and fake loopback services. Skipped integration tests are reported as skipped. Never commit copied application files, private runtime config, histories, logs or credentials.
