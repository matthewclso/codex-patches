# Acceptance evidence

This file records evidence against the authoritative [behavior contract](BEHAVIOR_CONTRACT.md); it does not redefine the requirements. Automated evidence is recorded separately from interactive behavior.

1. `npm test` checks module selection, archive and PE changes, transport framing, project paths and conditional SQLite updates. With pristine-source variables configured it also invokes actual app functions and the stock CLI against disposable loopback services.
2. `doctor` verifies the current signed source, generated file receipts, package identity and an isolated Windows-to-WSL app-server handshake. It reads the existing desktop config only to check path accessibility. No user session or provider request is initiated.
3. After a normal quit and launch, verify pet discovery, selection and installation with a disposable pet; use the Browser skill from an agent to open a page, inspect its content and follow a link; create/read a project using a Windows path; and check an existing Remote Control enrollment from a phone, including reconnect. If `project-memberships` is enabled, compare assigned chats and project names with the desktop, including a move between projects that share a folder. Save results locally without publishing account IDs or capabilities.
4. Exercise a disabled module by rebuilding from the signed source and inspecting the receipt. Re-enable it and rebuild before using that behavior. Confirm the normal signed launcher still opens Codex.
5. Only after these checks retire the previous custom launcher and its owned dependencies. Preserve shared data, pairing state and any rollback backups containing user data.

The copied executable retains package context but loses its original valid Authenticode signature. Report any signed-binary-only behavior separately. Hosted CI does not establish Windows 11 interactive behavior or authenticated cloud acceptance.

## September 30, 2026 local check

On Windows 11 with the Ubuntu 26.04 WSL backend, package `26.928.1915.0` passed the package-context startup check after relaunch. An existing custom pet appeared and remained selectable. An agent used the installed Browser plugin to open Example Domain, inspect its accessibility tree, follow its link to IANA, verify the destination and close the test tab.

Remote Control in the ChatGPT Android app reconnected and received chats with backend project IDs. Its initialization enabled `experimentalApi`; missing capability negotiation was therefore ruled out for this session. Android continued to display working-folder groups despite correct saved project memberships. This remains a [documented limitation](../patches/project-memberships/README.md), not a passed project-label check. The local migration was completed with that limitation explicitly accepted. These observations do not establish every interactive scenario above, such as installing a new pet or moving a chat between projects through the desktop UI.

## September 30, 2026 installer regression check

For package `26.928.2636.0`, an independent review process referencing an older generated CLI caused the original installer to report that the old deployment was in use after the app had closed. With the activation/cleanup checks separated, normal installation completed and `doctor` passed the package-context Windows-to-WSL startup check while that review process remained running. The old files still qualified for protection from cleanup. This checks LIFECYCLE-3/4/5; it does not establish interactive acceptance of this newer app build.

Disposable Windows and WSL processes verified that normal activation refuses a running prior app/backend without stopping it, while explicit `install -ForceClose` can stop blockers. Tests preserve independent review/exec commands and worker processes, reject stale process identities, and cover a WSL backend ignoring the initial termination signal. A separate Windows PowerShell → WSL fixture exercised detection, explicit termination and rechecking across the actual boundary. No real user app/backend was force-closed for these checks.

## October 2, 2026 compatibility review

Package `26.930.2377.0` (app `26.930.21537`, bundled CLI `0.159.0-alpha.12.1`) was checked against the installed signed stock files. Its archive and six executable/runtime hashes match the signed candidate captured by PR #2. The allowlist now records those source hashes, independent patch output hashes and the composed default archive/header/executable hashes. The original candidate remains an historical proposal; [the reviewed evidence](../compatibility/reviews/26.930.2377.0.json) records the later validation.

Actual-source tests reproduce the stock WSL pet path failure and verify discovery, selection and installation with the patch. All 256 browser prerequisite cases, 90 trusted-service generator cases, native project assignment scenarios and all 16 app-patch combinations pass. The executable changes only its ASAR header hash, and unrelated packed entries remain unchanged. Source-specific revisions preserve the prior implementations and unknown archives still fail closed.

The bundled stock CLI was exercised in Ubuntu 26.04 under WSL2 with temporary homes/databases and loopback enrollment services. The WSL UNC project-root and unfiltered Remote Control listing regressions remain present; their proxy/relay tests pass, including native pairing reuse, filtering, pagination, reconnect and owned-child cleanup. Stock GraphQL variables and apostrophes survive the actual Windows Node → `wsl.exe` boundary, so the GraphQL workaround remains retired. Windows and WSL toolkit suites pass; platform-specific skips are recorded separately.

This review did not install or activate a generated app or relaunch the desktop. Interactive pet rendering/installation, agent browser control after relaunch, and real-phone reconnect/project labels remain pending for this build. The accepted Android project-label limitation remains in effect. Project memberships remain disabled by default. Initial parallel WSL checks exhausted available memory and hit startup timeouts; the separated runs passed.

## October 3, 2026 compatibility review

Package `26.930.3930.0` (app `26.930.31730`, bundled CLI `0.160.0`) was checked against the installed signed stock files. All seven archive/executable/runtime hashes match the signed candidate in PR #4; the installed executable signature is valid. Source-specific revisions cover its renamed pet home/conversion exports, browser predicates/service generator and project membership gate. Prior supported builds and opt-in defaults are preserved. [The review record](../compatibility/reviews/26.930.3930.0.json) records the separate validation evidence.

Actual-source tests reproduce stock pet and browser failures and verify patched discovery, selection, installation, traversal guards, all 256 browser prerequisites, 90 service-path cases, native membership migration/writes and all 16 patch combinations. The allowlist pins independent patch outputs and the default composed archive/header/executable; source tests verify those pins. Windows and local Ubuntu 26.04 WSL2 toolkit/CI suites pass. The stock CLI still rejects matching WSL UNC project roots and omits projection-only chats from unfiltered native Remote Control listing; proxy/relay scenarios pass, including pairing reuse, filters, pagination, cursor reconnect, memberships, EOF and SIGTERM cleanup. Stock GraphQL quoting passes through Windows Node and `wsl.exe`, retaining its retirement.

The candidate's hosted WSL probe remains **unsupported**: its official runtime initialization/update failed with HTTP 403. Successful local WSL2 guest checks are separate evidence, not a repaired hosted run. No generated app was installed or activated, and no user session was closed. Interactive desktop pet/browser acceptance and real-phone reconnect/project labels remain pending for this build; the Android project-label limitation remains documented.

## October 5, 2026 compatibility review

Package `26.930.4958.0` (app `26.930.41038`, bundled CLI `0.160.0`) was reviewed against the installed signed stock files. All seven archive/executable/runtime hashes match the signed candidate in PR #5, and the installed executable signature is valid. Source revisions cover the renamed bundles and browser predicate; the membership renderer fixture uses its current bridge symbol. Prior supported builds remain intact. [The review record](../compatibility/reviews/26.930.4958.0.json) records the evidence.

Actual stock pet discovery and installation still fail when a Windows home is joined using POSIX paths; the patch fixes discovery, selection and installation while preserving traversal guards (PET-1/2). The in-app browser still rejects WSL; 256 prerequisite cases preserve its other restrictions and the external browser gate. Ninety service-generator cases verify Windows conversion only for WSL tasks (BROWSER-1/2/3). Native membership migration, new assignments, shared working folders, moves, clearing and backend guards pass; the option remains disabled by default (PROJECT-2/3/4). All 16 app-patch combinations and executable integrity checks pass.

Windows toolkit/CI tests passed 54 of 75 with 21 platform/source-specific skips; Ubuntu 26.04 under WSL2 passed 55 of 75 with 20 skips. Stock CLI fixtures still reproduce matching-UNC project rejection and the unfiltered Remote Control history failure; proxy/relay checks preserve canonical paths, pairing, pagination, reconnect and child cleanup (PATH-1/2, REMOTE-1/2/3). Stock GraphQL arguments pass through Windows Node and `wsl.exe` without the retired workaround. The reviewed package pipeline verifies composition and all six source tests against the allowlist (SELECT-3/4, CI-3/4, VERIFY-1/2/3).

The original hosted candidate booted Ubuntu 26.04 under WSL2 and passed native runtime checks but failed the six source tests before this review; that historical report is preserved. Fresh desktop startup, interactive pets, agent browser navigation and real-phone reconnect remain pending. Android project-label mismatch remains an accepted limitation. No running deployment, saved selection or user state was changed.

## October 6, 2026 compatibility review

Package `26.930.7945.0` (app `26.930.61225`, bundled CLI `0.160.1`) was reviewed against installed signed stock files. All seven archive/executable/runtime hashes match the signed candidate in PR #6; the installed executable signature is valid. Source revisions cover renamed bundles and pet loader functions; the GraphQL audit follows the current stock command generators. Prior supported builds and selection defaults remain intact. [The review record](../compatibility/reviews/26.930.7945.0.json) records the evidence.

Stock pet discovery and installation still fail when the Windows home is joined using POSIX paths; patched discovery, selection, installation and traversal guards pass with Windows/POSIX/WSL UNC homes (PET-1/2). The in-app browser still rejects WSL; 256 prerequisite cases preserve other restrictions and the external-browser predicate. Ninety service-generator cases verify conversion only for Windows workers with WSL paths (BROWSER-1/2/3). Native membership migration, new assignments, shared working folders, moves, clearing and backend guards pass; project memberships remain disabled by default (PROJECT-2/3/4). All six source tests, all 16 patch combinations and executable integrity checks pass.

Windows toolkit/CI tests passed 54 of 75 with 21 platform/source-specific skips; Ubuntu 26.04 WSL2 passed 55 of 75 with 20 skips. Bundled stock CLI 0.160.1 still reproduces matching-UNC project rejection and unfiltered Remote Control history failure; proxy/relay tests preserve canonical paths, pairing, pagination, reconnect and child cleanup (PATH-1/2, REMOTE-1/2/3). Stock GraphQL arguments pass through Windows Node and `wsl.exe` without the retired workaround. The reviewed package pipeline verifies all runtime hashes, composition and all six source tests against the allowlist (SELECT-3/4, CI-3/4, VERIFY-1/2/3).

The original hosted candidate booted Ubuntu 26.04 under WSL2, but its six source tests and GraphQL audit failed with old fixtures; that report is preserved. Fresh desktop startup, interactive pets, agent browser navigation and real-phone reconnect remain pending. Android project-label mismatch remains an accepted limitation. No running deployment, saved selection or user state was changed.

## October 8, 2026 compatibility review

Package `26.1002.7124.0` (app `26.1002.52244`, bundled CLI `0.162.0-alpha.2`) was reviewed from the installed Windows Store package. Windows reports Store signing and package status OK; `VerifyContentIntegrityAsync` returned true, the publisher matches the pin, and the executable Authenticode signature is valid. Seven installed file hashes, source/output hashes, native synchronizer and composed archive/executable hashes are pinned. [The review record](../compatibility/reviews/26.1002.7124.0.json) distinguishes this evidence from a downloaded MSIX.

Stock pet discovery and installation still join Windows home with POSIX paths. Patched discovery, selection and installation preserve traversal guards and pass Windows/POSIX/WSL UNC scenarios (PET-1/2). Browser WSL rejection remains; 256 prerequisite cases preserve other gates and the external-browser predicate. Ninety generator cases fix only Windows service paths for WSL tasks (BROWSER-1/2/3). Native membership migration, new assignments, shared working folders, moves, clearing and backend guards pass; project memberships remain opt-in (PROJECT-2/3/4). All six reviewed source tests and all 16 patch combinations pass.

Windows toolkit/CI tests passed 55 of 76 with 21 platform/source-specific skips; Ubuntu 26.04 WSL2 passed 56 of 76 with 20 skips. Stock CLI 0.162.0-alpha.2 still reproduces matching-UNC project rejection and unfiltered Remote Control history failure; proxy/relay fixtures preserve canonical paths, pairing, pagination, reconnect and cleanup (PATH-1/2, REMOTE-1/2/3). Stock GraphQL arguments survive Windows Node-to-`wsl.exe` without the retired workaround. The reviewed package pipeline passes using verified Store-package evidence; missing, failed or incomplete evidence is rejected (SELECT-3/4, CI-3/4, VERIFY-1/2/3).

The public MSIX URL and scheduled probe still return older package `26.930.7945.0`; those results are not current-build validation. Hosted WSL acceptance for this package was not run. Local WSL2 validation is recorded separately. Fresh desktop startup, interactive pets, actual agent browser navigation and real-phone reconnect remain pending; Android project-label mismatch remains an accepted limitation. The running app, saved settings and user state were not changed.

## Browser troubleshooting

An open browser panel does not prove that agents can control it. Follow the installed Browser skill and test navigation through its supported tool. If a chat's working directory was moved or deleted, restore it before refreshing that chat's tools: the backend starts local tool servers in the chat directory, and caches failed startup attempts. A fresh backend session is needed when the failed tool cannot be refreshed.

The browser worker runs on Windows even for a WSL chat. Use the installed plugin's same `scripts/browser-client.mjs` entrypoint with its native Windows absolute file URL when importing it there; a `/mnt/...` path names the WSL mount instead. Resolve the path for the current machine rather than copying another user's path. Successful import alone is not acceptance: browser discovery, page inspection and navigation must also succeed.

## October 9, 2026 connector and bundled runtime fixes

For the already reviewed package `26.1002.7124.0` / CLI `0.162.0-alpha.2`,
the relay's loopback URL reproduces the hosted connector authentication failure.
Native per-thread routing restores managed authentication while retaining the
remote listing relay. The separate Windows/Linux cache mismatch reproduces the
reserved bundled marketplace rejection; process-local cache alignment accepts
the managed source without weakening the native source/name checks.
[The supplemental record](../compatibility/reviews/26.1002.7124.0-connectors.json)
contains sources, test counts and limitations (CONNECTOR-1/2, RUNTIME-1,
REMOTE-1/2/3, SELECT-1/2/3, PATH-2, VERIFY-1/2/4).

The separate authenticated launcher process refreshed all 14 installed connectors
and exposed 566 tools and 95 resources with native `bearerToken` authentication
at the official HTTPS origin. It used the Python supervisor, Node relay and
unmodified bundled CLI with temporary relay state and the existing managed
account/database. Its internal ephemeral context stayed hidden from desktop
notifications, created no model turns, and EOF exited cleanly and released the
relay port. Inventory counts are dated responses, not a guarantee that every
provider action has been executed.

Native remote fixtures exercise discovery before desktop discovery, chunked
requests and hidden internal broadcasts alongside pairing reuse, filtering,
pagination and cursor reconnect, including native request errors on startup
timeout and segmentation of requests near the wire-size limit.
Windows tests passed 73 of 97 with 24 skips;
Ubuntu 26.04 WSL2 tests passed 77 of 97 with 20 skips. All six pristine-source
tests passed separately, including all 16 app-patch combinations. Existing
app-code transformations and their hashes are unchanged. Platform/source skips
are not passes. Startup probes with a new database triggered history indexing;
a concurrent source run exhausted a probe's memory allocation. The accepted
checks ran separately and used the existing database for authenticated discovery.
One combined run reported a wrapper exit in the WSL signal-shutdown fixture;
the isolated signal check and complete WSL rerun passed. Test cleanup now
preserves the initial failure. The original transient cause was not established.

This change has not activated a generated copy, changed the active launcher or
saved selection, or modified pairing state. Desktop agent tool discovery and
bundled runtime synchronization after relaunch, plus real-phone behavior with
both fixes active, remain pending. Legacy `app/list` retains native behavior
because this CLI ignores its session routing override. The current installed
connector APIs are covered. The accepted Android project-label limitation remains.
Native residency and account routing gates are preserved in the pinned source;
a live account with non-default residency was not available for acceptance.

## October 9, 2026 Browser and Computer Use recovery

For package `26.1002.7124.0` / app `26.1002.52244`, the running desktop produced a startup config-write timeout, leaving its app-managed worker paths and Computer Use pipe from a prior deployment. The Browser capability separately interpreted an expired feature-list request as a disable decision and its bundled plugin was removed. These are distinct from the connector authentication and primary-runtime cache fixes above.

The new `browser-feature-recovery` module retains confirmed Browser config feature state during transient discovery errors, keeps unknown first results pending, and preserves current workspace permission denial and explicit feature disables. `runtime-sync-recovery` retries transient native sync errors at most three times with fresh path/pipe selection, coalesces local-chat recovery, caches a successful recovery only for its current generation, and permits the next focus to retry failed bundled reconciliation. Existing native serialization, helper readiness and user-config reload remain in use. Successful reconciliation is still deduplicated. Runtime sync permanent errors retain native failure behavior. Browser config retention handles request errors while explicit authorization/entitlement errors retain stock denial behavior; partial marketplace results retain native post-reconcile work and invalidate the failed signature. These bug fixes default to `auto` on this reviewed build; older saved selections preserve opt-in project membership behavior and unsupported builds still fail closed.

Seven new tests execute the actual pristine capability descriptor/callback, Browser hook, availability publisher, config sync/generator, bundled reconciler and managed pipe runtime. They cover authorization denial, pending discovery, bounded retries, fresh executable/pipe settings, concurrent and sequential recovery, generation invalidation, unpublished feature state, continued external reconciliation after a failure, latest feature state winning, and one helper across repeated readiness calls without closing an active turn. All seven pass on Windows and Ubuntu 26.04 WSL2. Windows also passes all six existing source tests, now covering all **64** independent app-patch combinations, unrelated entries, syntax and independent/default-composed archive/header/executable pins. The combined 13-test Windows source run took 378 seconds. The five existing WSL source behavior/integrity tests pass separately; the 64-combination matrix is Windows evidence.

An independent Claude review of the final changes and native source excerpts found no remaining high or medium defects.

The final toolkit/CI-unit run passes 77 of 104 checks on WSL (27 skips) and 73 of 104 on Windows (31 skips), with zero failures. Platform/source skips are not passes.

Initial concurrent source loading exhausted WSL memory, and a broad native run stalled two existing proxy shutdown fixtures. Sequential source/native reruns passed. Source-heavy test files now run serially, with a 15-minute validator timeout. A Windows run initially selected the Python Store alias; acceptance uses the configured bundled Python. Neither environment failure was counted as a pass.

At source/protocol validation time, no new app copy had been activated and no user chat/backend had been closed for this recovery work. Agent Browser navigation/link interaction and Computer Use connection after relaunch remained **unverified** until installation and relaunch; the later live check is recorded below (BROWSER-2/3/4). Passing source/protocol tests does not establish live desktop tool acceptance or real-phone behavior.

## October 9, 2026 live Browser and Computer Use acceptance

After the user installed and relaunched the patched desktop, the active receipt selected both recovery modules for package `26.1002.7124.0`. The installed module source matched the reviewed branch. This later observation resolves the live Browser and Computer Use gap above (BROWSER-2/3/4, VERIFY-1/2).

An agent connected through the supported in-app Browser client, opened Example Domain in a temporary tab, inspected its accessibility state, clicked the observed Learn more link, and verified the Example Domains page at `https://www.iana.org/help/example-domains`. The agent closed the temporary tab after verification.

Through the supported Computer Use client, the agent discovered Windows applications, launched installed Notepad, selected its returned window, and captured accessibility and screenshot state. It clicked the blank text editor, typed a harmless test sentence, and verified the exact document text and screenshot. The first click reported unavailable coordinate geometry; refreshing the window, activating it and capturing screenshot-backed state allowed one successful retry. An earlier Calculator launch exposed no targetable window, so Calculator interaction was not accepted. Notepad was left open with the unsaved test sentence; no user document was modified or file saved.

These checks establish live Browser navigation and Computer Use discovery, window capture, activation, click and text input after this relaunch. They do not establish every connector, repeated reconnect stability, pet behavior or real-phone behavior. The executable-signature and Android project-label limitations remain documented.

## October 10, 2026 Codex 26.1007.2314.0 review

The installed Windows package `26.1007.2314.0` (app `26.1007.21434`, CLI `0.162.0-alpha.17.2`) matches all seven runtime/archive/executable hashes from the signed official MSIX candidate. Its installed executable signature and publisher were verified separately, and all **20,980** packed entries passed integrity checks.

Pet support moved out of bootstrap into its own bundle, but stock discovery, selection and installation still combine a Windows home with POSIX paths. The stock in-app Browser predicate still rejects WSL, its native-worker service path still needs conversion, and both Browser/runtime recovery patches remain necessary. The six app revisions and exact-source fixtures now follow this build's modules and native membership-record helpers. All **13** actual-source tests and **64** independent app-patch combinations passed on Windows before allowlisting, with zero failures or skips; unreviewed installation stayed rejected. Project memberships remain explicitly opt-in. PET-1/2, BROWSER-1/3/4 and PROJECT-2/3/4.

The current unmodified Linux CLI passed isolated WSL2 stock-versus-patched path, Remote Control listing, filtering, pagination, pairing, reconnect, connector discovery and reserved-marketplace/cache scenarios. The toolkit/CI suites passed **78 of 104** checks on Ubuntu 26.04 WSL2 (26 skips) and **73 of 104** on Windows (31 skips), with zero failures. Platform-specific, separately executed source checks and unavailable Windows file-symlink privilege account for skips; skips are not passes. Stock GraphQL quoting passed both the WSL audit and the Windows Node-to-`wsl.exe` boundary, including query variables and apostrophes, so its workaround remains retired. PATH-1/2, REMOTE-1/2/3, CONNECTOR-1/2 and RUNTIME-1.

The original automation candidate's failed source/composition/GraphQL checks and skipped recovery tests are preserved as historical evidence. The reviewed hashes and local results are recorded separately in `compatibility/reviews/26.1007.2314.0.json`. Earlier supported build entries remain unchanged. The final Windows package validator passed with `reviewedPackage: true` and `reviewRequired: false`, rerunning all 13 source tests and 64 combinations against the allowlist. CLI inspection reports this build supported and selects nine default patches, leaving project memberships disabled.

No generated copy was activated, no app was restarted, and saved configuration was not changed during this review. Current-build desktop startup, interactive pets, Browser/Computer Use actions, authenticated connector inventory and real-phone reconnect/display acceptance remain pending. The October 9 live acceptance belongs to the earlier build. The Android project-label limitation remains in effect. VERIFY-1/2/4.
