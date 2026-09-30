# Acceptance evidence

Automated evidence is recorded separately from interactive behavior.

1. `npm test` checks module selection, archive and PE changes, transport framing, project paths and conditional SQLite updates. With pristine-source variables configured it also invokes actual app functions and the stock CLI against disposable loopback services.
2. `doctor` verifies the current signed source, generated file receipts, package identity and an isolated Windows-to-WSL app-server handshake. It reads the existing desktop config only to check path accessibility. No user session or provider request is initiated.
3. After a normal quit and launch, verify pet discovery, selection and installation with a disposable pet; use the Browser skill from an agent to open a page, inspect its content and follow a link; create/read a project using a Windows path; and check an existing Remote Control enrollment from a phone, including reconnect. If `project-memberships` is enabled, compare assigned chats and project names with the desktop, including a move between projects that share a folder. Save results locally without publishing account IDs or capabilities.
4. Exercise a disabled module by rebuilding from the signed source and inspecting the receipt. Re-enable it and rebuild before using that behavior. Confirm the normal signed launcher still opens Codex.
5. Only after these checks retire the previous custom launcher and its owned dependencies. Preserve shared data, pairing state and any rollback backups containing user data.

The copied executable retains package context but loses its original valid Authenticode signature. Report any signed-binary-only behavior separately. Hosted CI does not establish Windows 11 interactive behavior or authenticated cloud acceptance.

## Browser troubleshooting

An open browser panel does not prove that agents can control it. Follow the installed Browser skill and test navigation through its supported tool. If a chat's working directory was moved or deleted, restore it before refreshing that chat's tools: the backend starts local tool servers in the chat directory, and caches failed startup attempts. A fresh backend session is needed when the failed tool cannot be refreshed.

The browser worker runs on Windows even for a WSL chat. Use the installed plugin's same `scripts/browser-client.mjs` entrypoint with its native Windows absolute file URL when importing it there; a `/mnt/...` path names the WSL mount instead. Resolve the path for the current machine rather than copying another user's path. Successful import alone is not acceptance: browser discovery, page inspection and navigation must also succeed.
