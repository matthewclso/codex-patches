# Backend runtime contract

The Windows launcher supplies `CODEX_CLI_PATH=codex-patches-proxy`. Windows
version discovery resolves a renamed stock executable; the selected WSL
distribution resolves the same command to `patches/wsl-project-paths/proxy.py`.
No shell profile is edited. The installer records ownership of the WSL command.

`CODEX_PATCHES_RUNTIME_CONFIG` names a private, owned POSIX JSON file. Its parent
must be private too. The schema is:

```json
{
  "schemaVersion": 1,
  "realCli": "/absolute/deployment/app/resources/codex",
  "cliSha256": "validated SHA-256 from the compatibility record",
  "cliVersion": "codex-cli supported-version",
  "codexHome": "/canonical/shared/codex/home",
  "sqliteHome": "/canonical/backend/sqlite",
  "stateRoot": "/private/stable/toolkit/state",
  "distro": "selected-distribution-name",
  "relayEnabled": true,
  "rewriteProjectPaths": true,
  "node": "/absolute/pinned/linux/node"
}
```

An optional `driveMounts` map supplies discovered drive-letter mounts, for
example `{"d":"/drives/d"}`. Without a map entry the adapter asks `wslpath`.
`CODEX_PATCHES_REAL_CLI`, when supplied, must resolve to exactly `realCli`.

Keep `stateRoot` stable while changing deployment-specific CLI paths and hashes.
The relay's private capability and port live under `stateRoot/relay` and have no
Codex version field. Updating the app does not create a new pairing identity.

The desktop gets its canonical Windows Codex home so it can read settings before
selecting a backend. The adapter passes the canonical POSIX home and SQLite
directory to its owned Linux child. The custom pet app patch chooses paths after
selecting the execution platform; historical pet-home junctions are unnecessary.

This startup adapter remains in place when both optional runtime modules are
disabled. Every stock CLI invocation, including version discovery and non-stdio
commands, receives the canonical backend home. Disabling request rewriting or
the relay must not redirect the Linux CLI into the Windows-format desktop home.

## Explicit state maintenance

Project membership repair uses existing desktop assignments and explicit host
identity mappings. It never infers a project from a working directory or repairs
a conflicting non-null assignment. The default operation prints counts only:

```text
node tools/repair-project-memberships.cjs --home=/absolute/codex/home --sqlite=/absolute/sqlite --binary=/absolute/stock/codex
```

Add `--apply --backup=/absolute/private/backup-root` to apply eligible assignments
after closing Codex. A consistent SQLite backup, desktop-state snapshot and
conditional rollback plan are recorded before mutation. Verification reads the
stock project/thread APIs without creating turns. Use `--host=host-key` if the
desktop's mapping key differs from `local:<canonical-home>`.

```text
node tools/repair-project-memberships.cjs --rollback=/absolute/project-sync-backup
```

Rollback changes only matching memberships and aborts on concurrent user changes.
Remote pairing migration has its separate plan/apply/rollback command documented
in `patches/remote-fast-list/README.md`; neither maintenance tool runs at launch.

## Verification limits

`npm test` includes portable parser, transport, SQLite and proxy-unit tests.
Native tests run only when `CODEX_RELAY_TEST_BINARY` explicitly identifies a stock
Linux CLI. `CODEX_PATCHES_TEST_ASAR` enables the stock GraphQL source regression
probe. These use isolated homes, mock authentication, local upstreams and no
model requests. Full desktop browser/pet behavior and real phone reconnect are
separate interactive acceptance checks.
