# Hosted CI and deterministic Codex updates

All jobs run on the free public-repository `windows-2025` x64 hosted image. There is no separate Ubuntu runner. The supported user target remains **Windows 11 x64 with Ubuntu 26.04 LTS in WSL2 selected as Codex's backend**. Windows Server is a CI environment; passing it does not establish Windows 11 desktop acceptance.

## Toolkit tests

`Toolkit tests` runs on pushes, pull requests, and manual dispatch. It executes the module tests on Windows, parses every PowerShell script, and checks the npm release payload for generated app binaries and private state. Native Linux app-server tests run only when a stock CLI is explicitly provided; a skip in the Windows unit job does not establish WSL acceptance.

## Official package and WSL2 compatibility

`Codex compatibility` runs daily and can be dispatched manually. It:

1. Downloads OpenAI's documented latest Store-signed x64 MSIX from `persistent.oaistatic.com`. Windows SDK `signtool` must validate the package signature. The manifest must identify `OpenAI.Codex`, x64, and the pinned publisher; the original desktop executable must have a valid signature.
2. Records separate package, app, and CLI versions, plus MSIX, ASAR, executable, Windows/Linux CLI, Windows/Linux Code Mode host, and bundled Windows Node SHA256 hashes. The stock files are extracted into the ephemeral runner's temporary directory.
3. Inspects the actual downloaded archive and runs the stock-versus-patched source behavior tests. Known patches are composed in memory and the executable integrity update is checked. Missing files, changed target hashes, and broken tests require review.
4. Checks WSL features on that Windows host, updates the official WSL runtime, and imports the exact Ubuntu 26.04 image listed by Microsoft's official WSL distribution index. It verifies Canonical's image URL and the index SHA256, and explicitly requests WSL2.
5. Boots the guest and verifies `/etc/os-release` and the WSL2 kernel. It installs the same Node 24 version used on Windows, verifies the official Node download checksum, and runs the repository tests **inside that WSL guest**.
6. Uses the unmodified Linux CLI from the downloaded MSIX to exercise app-server initialization, project creation, and task listing in isolated temporary data directories. The relay native tests exercise its protocol against a local fixture service with fake credentials. A separate fake `gh` probe exercises the downloaded stock GraphQL command generator through the bundled stock Windows Node → `wsl.exe` → Ubuntu, preserving query variables across the actual Windows/WSL boundary without contacting GitHub.
7. Uploads JSON and textual evidence reports only. The MSIX, app copy, Linux image, credentials, and runtime databases are never published.

The report distinguishes `passed`, `failed`, `unsupported`, and `not-run`. A feature that needs a reboot or a guest that cannot boot on the hosted VM is **unsupported**, not a successful integration test. The separately named final WSL2 acceptance step fails unless import, Ubuntu boot, repository tests, and the stock RPC probe actually passed. Source/unit success remains useful even when this separate acceptance check fails.

GitHub does not guarantee nested virtualization. The current hosted feasibility result is in each workflow run's `wsl.json`, rather than encoded as an assumption in the installer. A green toolkit/unit workflow and successful archive transformation are separate evidence from WSL acceptance. Browser UI, pet rendering, and authenticated phone reconnect remain local acceptance checks.

## New package proposals

The scheduled workflow uses ordinary scripts and `GITHUB_TOKEN`; no agent, OpenAI API key, or model calls are involved. Manual dispatch defaults to evidence only; enable **propose_update** to create a proposal.

For an already supported package, it exits without creating a PR. For a new package, it creates one draft PR per package/archive pair under `automation/codex-<version>-<hash>`. The PR contains public evidence and a candidate under `compatibility/candidates/`, even when changed code or unavailable WSL prevents acceptance. It never silently adds an unknown build to `compatibility/current.json`, enables a patch, or interprets a missing anchor as an upstream fix.

The maintainer reviews the report, fixes changed modules when necessary, reproduces the stock-versus-patched scenarios, and adds the build to the supported registry with the actual acceptance evidence. A candidate PR can be used to collect that work; merging candidate metadata alone does not support installation. The registry is the install authority. The next scheduled run recognizes a reviewed supported build without generating another proposal.

A candidate with unchanged targeted source can pass deterministic composition and source behavior tests. It still requires review of executable/package identity, runtime behavior, and the remaining desktop/mobile acceptance. Runtime CLI version changes also require an explicit review of adapter applicability and relay tests.

### GitHub settings

In **Settings → Actions → General → Workflow permissions**, allow GitHub Actions to create pull requests. The proposing job alone requests `contents: write` and `pull-requests: write`; ordinary CI has read access. No personal token is required.

GitHub documents that PRs created or updated using `GITHUB_TOKEN` may put the resulting PR workflows into an approval-required state. Approve those runs in the PR if needed. The proposal already links the same-run package/source/WSL evidence, so it does not claim the candidate was retested by an automatically triggered push workflow. Do not change to `pull_request_target` to bypass this restriction.

The daily schedule is best effort: GitHub may delay scheduled runs and disables schedules in inactive public repositories. Manual dispatch and local compatibility checks remain available.

### Releases

A maintainer pushing a `v*` tag runs `Release source toolkit`, validates the tracked source tree, and publishes a source ZIP including `package-lock.json`. App binaries are generated on each user's machine from their signed installed Codex package. The workflow does not redistribute Codex or upload a generated application copy.

## References

- [OpenAI's Windows deployment documentation and official x64 MSIX](https://learn.chatgpt.com/docs/enterprise/windows-deployment)
- [GitHub-hosted runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Microsoft's WSL distribution index](https://github.com/microsoft/WSL/blob/master/distributions/DistributionInfo.json)
- [WSL command reference](https://learn.microsoft.com/en-us/windows/wsl/basic-commands)
- [Triggering workflows with GITHUB_TOKEN](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
