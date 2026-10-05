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

## Browser troubleshooting

An open browser panel does not prove that agents can control it. Follow the installed Browser skill and test navigation through its supported tool. If a chat's working directory was moved or deleted, restore it before refreshing that chat's tools: the backend starts local tool servers in the chat directory, and caches failed startup attempts. A fresh backend session is needed when the failed tool cannot be refreshed.

The browser worker runs on Windows even for a WSL chat. Use the installed plugin's same `scripts/browser-client.mjs` entrypoint with its native Windows absolute file URL when importing it there; a `/mnt/...` path names the WSL mount instead. Resolve the path for the current machine rather than copying another user's path. Successful import alone is not acceptance: browser discovery, page inspection and navigation must also succeed.
