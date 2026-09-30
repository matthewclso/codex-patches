# User-visible behavior contract

This is the repository's **highest-authority source for intended behavior**. Code, tests, compatibility records, CI results, `AGENTS.md`, other documentation and historical notes must conform to it. If they disagree, treat that as a defect or an explicitly recorded limitation; do not redefine the requirement to match the implementation. Later explicit owner instructions take precedence and must be reflected here.

This contract describes what users should experience without requiring them or future coding agents to read the implementation. Module and command names identify today's delivery interfaces; internal techniques may change while preserving these outcomes. A passing test or an existing implementation is evidence, not permission to change the contract.

The source is every current user-authored message in the **Design Codex patch repository** task, including confirmation replies and the proposals whose defaults the owner accepted. The [message coverage ledger](#message-coverage-ledger) accounts for all 16 messages. Requirements, adopted delivery details, verification evidence and accepted limitations are distinguished below. Private transcripts, account data and machine-specific paths are not needed to use this document.

## Scope and delivery

**SCOPE-1 — Supported user environment.** Target the Windows 11 x64 Codex desktop app with **Ubuntu 26.04 LTS under WSL2 selected as the execution backend in Codex settings**. Windows Server is an accepted CI environment, not a claim of Windows 11 desktop acceptance. Windows ARM64, macOS, a Linux desktop installation and other WSL distributions/releases are outside the initial support promise. Discover the selected distribution's actual name rather than assuming it is literally `Ubuntu`.

**SCOPE-2 — A portable, complete repository.** A new user must be able to clone this public repository and install the patches using its documented prerequisites. Include all custom patch source, shared launcher/build tooling, dependency locks, compatibility information, tests and instructions. Do not depend on the original author's scripts, old chat working directories, usernames, drive letters, home aliases, project names or machine identities. Discover paths and runtimes or expose documented overrides. Reproducible dependency downloads are allowed; completely offline installation is not an initial requirement. Codex itself comes from the user's official installation. Do not redistribute generated Codex binaries, credentials, histories, pairing secrets or private runtime databases.

**SCOPE-3 — Preserve the official installation.** Generate an owned app copy from the user's pristine, supported, signed Codex installation. Compose enabled app-code patches into that copy. Keep the original installation available through an explicit stock-launch path. The owner accepted that modifying the copy invalidates its executable's original Authenticode signature: disclose this limitation and do not promise that features requiring a signed executable work in the copy. Retain the existing pet app-copy approach; a redesign solely to avoid that signature limitation was explicitly declined.

Sources: U01–U03 and their accepted design defaults.

## Patch selection and compatibility

**SELECT-1 — Independent modules.** Each patch has a separate module, purpose, applicability decision and verification scenario. Users can enable or disable it without editing its implementation. Removing one module's contribution must preserve other selected fixes. Independent selection does not mean each patch alone fixes every part of a multi-part feature: both browser modules may be needed for a working browser. Explain such interactions rather than silently changing the selection.

**SELECT-2 — Selection modes.** The adopted interface provides `auto`, `enabled` and `disabled` per module. `auto` applies only fixes reviewed as needed for the installed build. `enabled` selects a reviewed fix explicitly and still enforces compatibility checks. `disabled` omits that module's patch. Rebuild app-code selections from pristine files so disabling a patch does not leave its previous edits behind. Reuse the user's saved selection during updates; do not silently enable a newly introduced opt-in state-changing module.

**SELECT-3 — Unknown or changed builds.** Check the actual installed package, app and bundled CLI identities and relevant hashes. Refuse unvalidated patching or activation when those checks fail, with a useful explanation and an explicit stock-launch option. Do not silently launch an older patched copy as though it patched the newly installed version, or let `enabled` bypass review. Preparing a copy is not the same as activating it.

**SELECT-4 — Audit and retirement.** For each supported build, distinguish needed, fixed upstream, inapplicable and unresolved workarounds. Establish retirement with the relevant behavior working on stock Codex. A missing replacement anchor or a changed hash means investigation is required, not that upstream fixed the problem. Stop applying obsolete fixes and retain concise retirement evidence and useful regression coverage. Initial support is for audited builds, not every historical Codex release.

Sources: U01–U03. These selection semantics were part of the accepted design.

## Feature behavior

### Custom pets

**PET-1.** With the pet fix enabled, existing custom pets in the user's canonical Codex data are discoverable, appear in the picker, can be selected, and load correctly through the WSL backend. Installing a custom pet must write to the intended pet data location so it is subsequently discoverable and selectable. The Windows/WSL boundary must not cause missing pets, failed metadata/image reads or installation into a malformed path.

**PET-2.** Preserve the user's pet assets, selections and existing identifier validation. Do not restore the historical drag/input workarounds or their ongoing tracing/polling as part of normal pet behavior. Those experiments were excluded from the adopted design; this is a path-compatibility fix, not a new pet interaction system. This exclusion does not prohibit bounded diagnostics during an authorized investigation.

Current module: `custom-pets`. The owner confirmed appearance and selection in the running copy (U09); that confirmation does not prove a fresh pet installation was tested. Sources: U01's request to preserve needed existing patches, U03's pet decision, U09; the accepted inventory described discovery, loading and installation.

### Built-in browser available to agents

**BROWSER-1.** Treat built-in browser enablement under WSL as an included bug fix. An otherwise eligible user must not lose the browser solely because WSL is the selected backend. Preserve other browser preferences, model and feature prerequisites, permissions and security restrictions. The external Chrome integration is a separate feature and must retain its normal behavior.

**BROWSER-2.** An agent in a Codex chat using the supported backend, including a chat rooted in a Linux repository, must be able to discover and control the built-in browser through its supported tools: open a page, inspect its content, interact with a link and verify the destination. Windows-hosted browser workers must be able to load the service needed by such a chat. An enabled menu, visible browser panel, successful module import, or startup-only check is insufficient.

**BROWSER-3.** Verify this from an actual agent after the patched copy is running; do not ask the user to substitute a manual page-opening check for agent availability. Report a failed or unavailable tool session as unverified until it is resolved. A missing chat working directory was a diagnostic prerequisite encountered during migration, not a promise that this toolkit recreates arbitrary deleted workspaces.

Current modules: `browser-wsl` and `browser-service-path`. Sources: U02 and U08; the accepted browser inventory covers both eligibility and service loading.

### Windows paths for WSL projects

**PATH-1.** Creating, importing or updating a project using a Windows drive path must reach the corresponding directory in the selected WSL backend, using the machine's actual mount mapping. A WSL UNC path for that same distribution must also resolve correctly. Existing Linux paths must remain usable. Do not silently reinterpret a path belonging to another distribution as belonging to the selected one, or rewrite unrelated agent commands and responses.

**PATH-2.** This behavior must work through the ordinary desktop/shortcut startup environment. An absolute-path invocation of a helper is not enough if the launcher cannot find that helper. The Windows desktop and Linux backend must continue using their respective representations of the same intended Codex data, including when optional runtime patches are disabled. Toggling a request fix must not make existing chats, settings or pets appear lost by selecting a different home.

Current module: `wsl-project-paths`, plus shared launch setup. Source: U01's existing-patch migration request and the accepted project-path/portable-launch design. These are adopted delivery requirements, not a request to support every arbitrary UNC share.

### Remote Control listing and reconnect

**REMOTE-1.** Remote Control on the phone must load the user's existing chats without the historical unfiltered-history listing failure. Preserve normal filters, pagination and access to subsequent pages. Closing and reopening Remote Control must allow it to reconnect and use the same desktop/backend. No numerical latency guarantee was requested.

**REMOTE-2.** Updating or rebuilding the toolkit must preserve existing pairing, server/environment identity and Remote Control enable/disable preferences. Do not require re-pairing merely because a generated copy or toolkit version changed. Preserve authentication, explicit account/residency routing, configured network proxies and TLS verification. Disabling the fix must allow native routing using the retained original enrollment data.

**REMOTE-3.** Use the supported stock CLI/protocol and narrowly repair the affected listing path. Do not reintroduce obsolete custom Rust CLI distributions or alter unrelated commands, response content, pagination cursors or delivery semantics. Keep setup/state migration separate from ordinary launch. Report protocol-fixture results and real-phone behavior separately.

Current module: `remote-fast-list`. Sources: U01–U03's accepted relay design, U08's successful loading report, and U14's real-phone refresh. Reconnect is a target and has separate observed evidence; U08 alone did not confirm every reconnect scenario.

### Named project assignments and the Android limitation

**PROJECT-1 — Intended project meaning.** A chat assigned to a named desktop project belongs to that project, regardless of its working folder. Multiple named projects may share a folder; one named project may contain chats with different working folders. Folder basenames must not be treated as authoritative project identity. The owner's requested phone experience uses the actual project names, rather than generated chat-folder names.

**PROJECT-2 — Delivered backend synchronization.** The optional `project-memberships` module makes recorded desktop assignments available as backend memberships. With that option enabled, existing eligible assignments, new assigned chats, moves between projects and clearing an assignment must follow the intended project identity and persist. Use recorded assignments and explicit identity mappings; do not guess from `cwd`. Archived or unavailable chats must be reported/deferred rather than assigned by a folder-name heuristic.

**PROJECT-3 — Opt-in and persisted state.** This module is disabled by default, including when an older saved configuration lacks its setting. Explain before enabling it that native initial synchronization follows desktop assignments and can overwrite a conflicting backend assignment. Disabling the patch does not erase already-persisted memberships or suppress an independently upstream-enabled native feature. The separate conservative repair utility must preview changes, back up state before applying, and leave conflicting non-null assignments for review; rollback must not overwrite later user changes.

**PROJECT-4 — Accepted limitation, not a fulfilled UI requirement.** The ChatGPT **Android app** still displayed working-folder groups after backend assignments were correctly synchronized. The owner explicitly accepted completing migration with this limitation documented (U15). Backend project IDs, successful synchronization, correct desktop names, or a green test must never be reported as proof that Android displays the requested names. Keep the phone-label mismatch visible until an actual Android check demonstrates it is fixed. Acceptance of the limitation does not redefine folder names as correct project names, and does not establish behavior in the mobile web or iPhone clients.

**PROJECT-5.** Do not cosmetically “fix” phone labels by changing a chat's working directory, merging projects that share a folder, inventing assignments, or renaming the owner's projects. A future label fix must preserve where commands run and the owner's actual project membership.

Sources: U08, U11–U15. The optional module and conservative repair semantics are the delivered operational specification supporting that request; they are not a claim that the requested Android display behavior is implemented.

## Installation, updating and removal

**LIFECYCLE-1 — A documented ordinary-user workflow.** Provide inspect, install, launch, validation, patch selection, update, explicit stock launch, cleanup and uninstall operations with clear prerequisites and actionable failures. Installation must be reproducible from the repository and documented downloads, without private scripts. Keep generated output in clearly owned locations and avoid persistent shell-profile workarounds. Today's entry point is `codex-patches.ps1`; [README](../README.md) documents the commands.

**LIFECYCLE-2 — A repository-owned shortcut.** Include desktop shortcut creation in the repository and normal installation. Provide a command to recreate it without rebuilding. The clearly named **Codex - Patched** shortcut must target a stable installed launcher, survive version changes and remain usable if the checkout is moved or deleted. Optional/custom install locations must be supported by that same workflow. During an explicit legacy migration, retarget only recognized old patch shortcuts and leave unrelated shortcuts alone.

**LIFECYCLE-3 — Predictable updates.** The user can update Codex normally, pull the repository, inspect compatibility, rebuild/apply the saved patch selection, validate, remove unused generated copies and relaunch through the same shortcut. Pulling Git changes alone must not mutate the running deployment. Verify the prepared copy before activation, and keep selection/activation status clear when a running deployment prevents switching. Retain private relay state across rebuilds.

**LIFECYCLE-4 — Active-session protection.** Installation, launching and cleanup must not silently kill Codex chats, terminate unrelated processes, or shut down all WSL distributions to recover. Coordinate a normal user quit/relaunch when needed; do not remove a deployment or legacy path that an active process still needs. A user's temporary request to keep a session running must be respected until they authorize or perform the switch.

**LIFECYCLE-5 — Remove code while preserving user data.** Cleanup and uninstall must remove recognized, owned patch outputs rather than arbitrary files. Preview destructive maintenance, check ownership/changed links/in-use paths, and preserve shared Codex data, histories, settings, pet assets, pairing data and relevant state/rollback backups. Removing an alias must preserve its data target. Preserve and verify selected historical diagnostics before deleting legacy code. Data backups are distinct from obsolete executable launcher/proxy copies.

**LIFECYCLE-6 — Complete legacy independence.** Once the repository installation is accepted, remove inventoried legacy launchers, custom binaries, app copies, shims, proxies, obsolete build/code-backup directories and stale references. The final installation must run without them; keeping an old launcher as a hidden dependency is not completion. Keep only the active or intentionally retained repository-generated copies and required private state. Migration may proceed with a known limitation only when that limitation is explicitly accepted, as Android labels were in U15.

Sources: U01–U07, U10, U15 and accepted installation/cleanup defaults. The hold in U04 was superseded by the later relaunches and cleanup decision; it is not a permanent ban on updates.

## Hosted CI and new Codex versions

**CI-1 — Hosted Windows with actual WSL evidence.** Use GitHub-hosted Windows runners for the first version; Windows Server runners are acceptable. Exercise Ubuntu 26.04 LTS in WSL2 on that Windows host when establishing Windows/WSL integration. A separate Ubuntu runner is not a substitute for that boundary. Do not make a paid or self-hosted runner a prerequisite for the initial workflow.

**CI-2 — Deterministic discovery and proposals.** Provide scheduled and manual checks for newly available official Codex packages. Inspect the version/source, attempt existing applicable transformations, test the composed result and publish reviewable compatibility evidence. The proposal workflow creates an update proposal for a new build, with failures or ambiguous applicability surfaced for investigation; manual runs may collect evidence without proposing an update. Do not require an agent, model invocation or an OpenAI API key. Do not repeatedly propose an already supported package.

**CI-3 — Review before support.** A candidate/proposal is not installation approval. Human review must precede declaring a new build supported or retiring a patch. Do not automatically trust new hashes because replacement text still matches, merge proposals, or turn skipped tests into compatibility approval. `compatibility/current.json` is the runtime allowlist for reviewed builds; its entries are subordinate to this behavior contract.

**CI-4 — Honest evidence and distributable outputs.** Distinguish source/build success, protocol tests, actual WSL2 guest execution, and Windows desktop/real-phone acceptance. Report failed, unsupported, skipped or not-run checks accurately. If hosted WSL cannot boot or needs an unavailable reboot, report that limitation; do not label the integration accepted. Publish the source toolkit, public compatibility metadata and sanitized reports. Users generate app copies locally; no proprietary app files or private runtime state belong in release artifacts.

Sources: U01–U03 and accepted update-proposal defaults. The current daily schedule, exact runner image, report filenames and release commands are operational details in [CI documentation](ci.md), not permission to weaken these outcomes.

## Regression and acceptance rules

**VERIFY-1 — Test the user path.** For an affected behavior, verify both the original failure scenario and the intended patched outcome, including interactions with other enabled modules. Use the ordinary launcher/backend context for end-to-end claims. Passing a helper invocation, archive edit, startup probe or mock alone does not establish the user's experience.

| Change affects | Acceptance must address |
| --- | --- |
| Pet paths | Discovery, selection/loading and installation behavior; record separately which UI actions were actually exercised. |
| Browser eligibility/service loading | Agent tool availability from a supported chat, page inspection, interaction and verified navigation after relaunch. |
| Project paths/home selection | Project create/import/update at the intended directory; canonical data remains available with runtime modules toggled. |
| Remote listing/routing | Existing chat listing, pagination and reconnect; preserve pairing and account preferences across updates. |
| Project membership | Distinct projects sharing a folder, creation/move/clear persistence, and conflict handling. Android label display remains a separate check. |
| Installation/cleanup | Real shortcut target and activation, session protection, owned-file removal, retained data and operation without old paths. |
| Compatibility/CI | Stock versus patched applicability, composed selections and an honest Windows/WSL result; reviewed support decisions. |

**VERIFY-2 — Keep status separate from requirements.** [Acceptance evidence](acceptance.md) records observations, versions and limits. The September 30 user confirmation establishes that an existing pet appears and is selectable; it does not establish every pet operation. The agent browser navigation check establishes real agent control. Remote loading/backend memberships do not establish correct Android labels. Do not copy a dated pass forward to a new build or broaden what was tested.

**VERIFY-3 — Preserve upstream-fixed behavior without obsolete patches.** Removing an obsolete workaround must leave its user scenario working on stock. In particular, GitHub GraphQL queries and variables must survive generated commands crossing the Windows-to-WSL shell boundary, and pets must remain accessible through the canonical data home without old aliases. The audited GraphQL shell guard and pet-home aliases are retired, not features to reinstall merely because they once existed. Old terminal/Node bridge fixes, custom CLI builds and pet input experiments were candidates/exclusions in the history, not a requirement to ship every old technique. [Retirement records](retired.md) explain current evidence; reassess changed builds rather than blindly reviving the old implementation.

**VERIFY-4 — Future changes.** Refer to the affected requirement IDs when planning a behavior change or fixing a regression. Keep tests and supporting docs aligned with the intended outcome; do not edit this contract simply to make broken behavior appear compliant. An explicit new owner decision can change the contract. If an unresolved question changes the user-visible promise, record it as unresolved and obtain clarification rather than treating existing code as the answer. This is not an extra approval step for ordinary fixes that already conform to the contract.

## Message coverage ledger

All times below are September 30, 2026, America/New_York. The full user messages and their question context were reviewed; this is a requirements index, not a public transcript. Automatic environment/Page-context entries add no product behavior. The edited current document request supersedes its earlier wording.

| ID / time | User message or reply | Effect on this contract |
| --- | --- | --- |
| U01 · 02:08 | Move the accumulated patches from the four named prior tasks into a tidy, portable GitHub repo; modular toggles, audit upstream fixes, CI, install/icon/update/cleanup instructions; remove local legacy code after migration; design first. | SCOPE, SELECT, feature inventory, LIFECYCLE, CI. The initial implementation hold was superseded by U03. Historical task code is context, not authority over this contract. |
| U02 · 03:23 | Ask which app-code patches remain and about Actions; specify Windows 11 x64/Ubuntu 26.04 LTS/WSL2; include browser enablement as a bug fix; ask about avoiding pet-copy signatures; accept remaining defaults. | Supported scope; browser inclusion; compatibility, review, repair, dependency and initial-version defaults from the preceding design. Pet alternative was a question, later resolved by U03. |
| U03 · 03:31 | Keep the pet implementation; accept app copies despite signatures; accept Windows Server hosted CI; question separate Ubuntu testing; choose deterministic automation; start implementation. | Final app-copy/CI decisions. Overrides the proposed pet redesign, alternative runner exploration and implementation hold. |
| U04 · 04:14 | “Keep the current session running for now” in response to the quit/relaunch question. | Temporary activation hold; LIFECYCLE-4. Not a permanent prohibition on later user-requested switching. |
| U05 · 08:36 | “Just relaunched from the launcher.” | Evidence that a launch was attempted; requires checking the actual active copy, not assuming its identity or feature success. |
| U06 · 08:39 | “Include shortcut creation in the repo too.” | LIFECYCLE-2; an out-of-repository one-off shortcut is insufficient. |
| U07 · 08:48 | “Relaunched.” | Further activation evidence, not acceptance of all features. |
| U08 · 08:54 | Test the browser yourself so it is available to agents; Remote Control loads, but labels show chat-folder names instead of named projects. | BROWSER-2/3, REMOTE-1, PROJECT-1/4. Loading and project naming are separate outcomes. |
| U09 · 09:09 | “Yes, it works” to whether the pet appears and remains selectable. | PET-1 and bounded acceptance evidence; not proof of installation or new interaction features. |
| U10 · 10:25 | “Relaunched.” | Activation evidence; supersedes the temporary U04 hold for that switch. |
| U11 · 10:29 | “Names still show folder names” after backend assignment synchronization. | PROJECT-4 and VERIFY-2: successful data synchronization did not satisfy phone-label expectations. |
| U12 · 10:46 | Supply the 11 labels shown on the phone. | Diagnostic evidence for the folder/name mismatch. These are not a required dataset, portable defaults or project configuration to embed. |
| U13 · 10:47 | Identify the client as “ChatGPT Android app.” | Bounds the observed limitation to that client; no mobile-web/iPhone acceptance claim. |
| U14 · 10:56 | “Done” after reopening Remote Control for the bounded diagnostic. | Evidence that the requested diagnostic action was performed, not a claim that labels were fixed. |
| U15 · 10:58 | “Finish migration; document Android limitation.” | Explicitly permits legacy removal with PROJECT-4 unresolved and documented; does not redefine folder labels as correct. |
| U16 · 11:11 | Create this repo's complete user-visible behavior document from every user message; give it higher authority than every other repo source to prevent regressions. | This contract, its precedence, the coverage ledger and VERIFY-4. |

“Accepted defaults” above refers to the two design responses preceding U02 and U03: a small modular toolkit and one composed app copy, reviewed build support, explicit stock fallback, deliberate preview/backup state repairs, reproducible downloads, deterministic update proposals, and cleanup only after validating independence from old code. Later explicit user decisions override those proposals. Unchosen alternatives and implementation details are not silently promoted into owner requests.
